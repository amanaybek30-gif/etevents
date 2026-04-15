import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MessageCircle, Eye, EyeOff, Send, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Props {
  userId: string;
}

interface Discussion {
  id: string;
  event_id: string;
  author_name: string;
  author_email: string | null;
  question: string;
  answer: string | null;
  is_visible: boolean;
  created_at: string;
}

const OrganizerDiscussions = ({ userId }: Props) => {
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("all");
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Discussion | null>(null);

  const fetchData = useCallback(async () => {
    const { data: evs } = await supabase.from("events").select("id, title").eq("organizer_id", userId);
    if (!evs || evs.length === 0) { setLoading(false); return; }
    setEvents(evs);

    const ids = evs.map(e => e.id);
    const { data: disc } = await supabase.from("event_discussions")
      .select("*")
      .in("event_id", ids)
      .order("created_at", { ascending: false });
    if (disc) setDiscussions(disc as Discussion[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (events.length === 0) return;
    const channel = supabase
      .channel('discussions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_discussions' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [events, fetchData]);

  const filtered = discussions.filter(d => selectedEvent === "all" || d.event_id === selectedEvent);
  const eventTitle = (eventId: string) => events.find(e => e.id === eventId)?.title || "Unknown";

  const toggleVisibility = async (disc: Discussion) => {
    const { error } = await supabase.from("event_discussions")
      .update({ is_visible: !disc.is_visible })
      .eq("id", disc.id);
    if (error) { toast.error("Failed to update"); return; }
    toast.success(disc.is_visible ? "Question hidden" : "Question visible");
    fetchData();
  };

  const submitReply = async (discId: string) => {
    if (!replyText.trim()) return;
    const { error } = await supabase.from("event_discussions")
      .update({ answer: replyText.trim(), answered_by: userId, answered_at: new Date().toISOString() })
      .eq("id", discId);
    if (error) { toast.error("Failed to reply"); return; }
    toast.success("Reply posted!");
    setReplyingTo(null);
    setReplyText("");
    fetchData();
  };

  const deleteDiscussion = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("event_discussions").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Question deleted");
    setDeleteTarget(null);
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading discussions...</div>;

  const unanswered = filtered.filter(d => !d.answer).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="font-display text-2xl font-bold text-foreground">{filtered.length}</p>
          <p className="text-xs text-muted-foreground">Total Questions</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="font-display text-2xl font-bold text-yellow-500">{unanswered}</p>
          <p className="text-xs text-muted-foreground">Unanswered</p>
        </div>
      </div>

      {events.length > 1 && (
        <Select value={selectedEvent} onValueChange={setSelectedEvent}>
          <SelectTrigger className="w-[200px] border-border bg-secondary"><SelectValue placeholder="Filter event" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center space-y-2">
          <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No questions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(disc => (
            <div key={disc.id} className={`rounded-xl border bg-card p-4 space-y-3 ${!disc.is_visible ? 'border-destructive/30 opacity-60' : 'border-border'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground text-sm">{disc.author_name}</span>
                    {events.length > 1 && <span className="text-xs text-primary">{eventTitle(disc.event_id)}</span>}
                    <span className="text-xs text-muted-foreground">{new Date(disc.created_at).toLocaleDateString()}</span>
                    {!disc.is_visible && <span className="text-[10px] text-destructive font-semibold">HIDDEN</span>}
                  </div>
                  <p className="text-sm text-foreground mt-1">{disc.question}</p>
                  {disc.author_email && <p className="text-xs text-muted-foreground mt-0.5">{disc.author_email}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => toggleVisibility(disc)} className="h-8 px-2">
                    {disc.is_visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(disc)} className="h-8 px-2 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {disc.answer && (
                <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                  <p className="text-xs font-semibold text-primary mb-1">Organizer Reply</p>
                  <p className="text-sm text-foreground">{disc.answer}</p>
                </div>
              )}

              {!disc.answer && (
                <>
                  {replyingTo === disc.id ? (
                    <div className="flex gap-2">
                      <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write your reply..." className="border-border bg-secondary text-sm min-h-[60px]" />
                      <div className="flex flex-col gap-1">
                        <Button size="sm" onClick={() => submitReply(disc.id)} className="bg-gradient-gold text-primary-foreground h-8">
                          <Send className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setReplyingTo(null); setReplyText(""); }} className="h-8 text-xs">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setReplyingTo(disc.id)} className="border-border hover:border-primary hover:text-primary text-xs">
                      <Send className="h-3 w-3 mr-1" /> Reply
                    </Button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Question"
        description={`Delete this question from "${deleteTarget?.author_name}"?`}
        onConfirm={deleteDiscussion}
      />
    </div>
  );
};

export default OrganizerDiscussions;

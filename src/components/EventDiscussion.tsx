import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageCircle, Send } from "lucide-react";

interface Props {
  eventId: string;
}

interface Discussion {
  id: string;
  author_name: string;
  question: string;
  answer: string | null;
  created_at: string;
}

const EventDiscussion = ({ eventId }: Props) => {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchDiscussions = async () => {
    const { data } = await supabase.from("event_discussions")
      .select("id, author_name, question, answer, created_at")
      .eq("event_id", eventId)
      .eq("is_visible", true)
      .order("created_at", { ascending: false });
    if (data) setDiscussions(data);
    setLoading(false);
  };

  useEffect(() => { fetchDiscussions(); }, [eventId]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`discussion-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_discussions' }, () => fetchDiscussions())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !question.trim()) { toast.error("Name and question are required"); return; }
    setSubmitting(true);

    const { error } = await supabase.from("event_discussions").insert({
      event_id: eventId,
      author_name: name.trim(),
      author_email: email.trim() || null,
      question: question.trim(),
    });

    setSubmitting(false);
    if (error) { toast.error("Failed to post question"); return; }
    toast.success("Question posted!");
    setName(""); setEmail(""); setQuestion("");
    setShowForm(false);
    fetchDiscussions();
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" /> Discussion
        </h2>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} className="border-border hover:border-primary hover:text-primary">
          Ask a Question
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-sm text-foreground">Your Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="border-border bg-secondary mt-1" required />
            </div>
            <div>
              <Label className="text-sm text-foreground">Email (optional)</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="border-border bg-secondary mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-sm text-foreground">Your Question *</Label>
            <Textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="What would you like to know?" className="border-border bg-secondary mt-1 min-h-[80px]" required />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting} className="bg-gradient-gold text-primary-foreground hover:opacity-90">
              <Send className="mr-1 h-4 w-4" /> {submitting ? "Posting..." : "Post Question"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : discussions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No questions yet. Be the first to ask!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {discussions.map(d => (
            <div key={d.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground text-sm">{d.author_name}</span>
                <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-foreground">{d.question}</p>
              {d.answer && (
                <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 mt-2">
                  <p className="text-xs font-semibold text-primary mb-1">Organizer Reply</p>
                  <p className="text-sm text-foreground">{d.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default EventDiscussion;

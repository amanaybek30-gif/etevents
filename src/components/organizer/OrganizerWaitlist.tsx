import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, Mail, Trash2, Download, Clock, UserCheck } from "lucide-react";
import * as XLSX from "xlsx";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Props {
  userId: string;
  isPaid?: boolean;
  onRequirePlan?: () => void;
}

interface WaitlistEntry {
  id: string;
  event_id: string;
  full_name: string;
  email: string;
  phone: string;
  position: number;
  status: string;
  invite_token: string | null;
  invited_at: string | null;
  invite_expires_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  waiting: "bg-yellow-500/10 text-yellow-500",
  invited: "bg-blue-500/10 text-blue-500",
  registered: "bg-green-500/10 text-green-500",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const OrganizerWaitlist = ({ userId, isPaid = true, onRequirePlan }: Props) => {
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("all");
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<WaitlistEntry | null>(null);

  const fetchData = useCallback(async () => {
    const { data: evs } = await supabase.from("events").select("id, title").eq("organizer_id", userId);
    if (!evs || evs.length === 0) { setLoading(false); return; }
    setEvents(evs);

    const ids = evs.map(e => e.id);
    const { data: wl } = await supabase.from("event_waitlist")
      .select("*")
      .in("event_id", ids)
      .order("position", { ascending: true });
    if (wl) setEntries(wl as WaitlistEntry[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    if (events.length === 0) return;
    const channel = supabase
      .channel('waitlist-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_waitlist' }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [events, fetchData]);

  const filtered = entries.filter(e => selectedEvent === "all" || e.event_id === selectedEvent);
  const eventTitle = (eventId: string) => events.find(e => e.id === eventId)?.title || "Unknown";

  const manualInvite = async (entry: WaitlistEntry) => {
    if (!isPaid) { onRequirePlan?.(); return; }
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("event_waitlist")
      .update({ status: "invited", invite_token: token, invited_at: new Date().toISOString(), invite_expires_at: expiresAt })
      .eq("id", entry.id);
    if (error) { toast.error("Failed to invite"); return; }

    // Send invite email via edge function
    const ev = events.find(e => e.id === entry.event_id);
    supabase.functions.invoke("send-waitlist-invite", {
      body: { email: entry.email, name: entry.full_name, eventTitle: ev?.title || "Event", token, eventSlug: "" }
    }).catch(err => console.error("Waitlist invite email failed:", err));

    toast.success(`Invite sent to ${entry.full_name}`);
    fetchData();
  };

  const removeEntry = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("event_waitlist").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Failed to remove"); return; }
    toast.success("Removed from waitlist");
    setDeleteTarget(null);
    fetchData();
  };

  const exportWaitlist = () => {
    if (filtered.length === 0) { toast.error("Nothing to export"); return; }
    const data = filtered.map(e => ({
      "Position": e.position,
      "Name": e.full_name,
      "Email": e.email,
      "Phone": e.phone,
      "Status": e.status,
      "Event": eventTitle(e.event_id),
      "Joined": new Date(e.created_at).toLocaleString(),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Waitlist");
    XLSX.writeFile(wb, `Waitlist_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Exported!");
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading waitlist...</div>;

  const waitingCount = filtered.filter(e => e.status === "waiting").length;
  const invitedCount = filtered.filter(e => e.status === "invited").length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="font-display text-2xl font-bold text-foreground">{filtered.length}</p>
          <p className="text-xs text-muted-foreground">Total Waitlisted</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="font-display text-2xl font-bold text-yellow-500">{waitingCount}</p>
          <p className="text-xs text-muted-foreground">Waiting</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="font-display text-2xl font-bold text-blue-500">{invitedCount}</p>
          <p className="text-xs text-muted-foreground">Invited</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        {events.length > 1 && (
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger className="w-[200px] border-border bg-secondary"><SelectValue placeholder="Filter event" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {filtered.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportWaitlist} className="border-border hover:border-primary hover:text-primary">
            <Download className="mr-1 h-3.5 w-3.5" /> Export
          </Button>
        )}
      </div>

      {/* Entries */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center space-y-2">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No waitlist entries yet</p>
          <p className="text-xs text-muted-foreground">When your event reaches capacity and waitlist is enabled, attendees will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => (
            <div key={entry.id} className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground text-sm">#{entry.position} {entry.full_name}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[entry.status] || STATUS_COLORS.waiting}`}>
                    {entry.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{entry.email} · {entry.phone}</p>
                {events.length > 1 && <p className="text-xs text-primary mt-0.5">{eventTitle(entry.event_id)}</p>}
                {entry.invited_at && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Invited {new Date(entry.invited_at).toLocaleString()}
                    {entry.invite_expires_at && ` · Expires ${new Date(entry.invite_expires_at).toLocaleString()}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {entry.status === "waiting" && (
                  <Button size="sm" variant="outline" onClick={() => manualInvite(entry)} className="border-border hover:border-primary hover:text-primary h-8 text-xs">
                    <Mail className="h-3 w-3 mr-1" /> Invite
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(entry)} className="h-8 px-2 text-destructive hover:text-destructive/80">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Remove from Waitlist"
        description={`Remove "${deleteTarget?.full_name}" from the waitlist?`}
        onConfirm={removeEntry}
      />
    </div>
  );
};

export default OrganizerWaitlist;

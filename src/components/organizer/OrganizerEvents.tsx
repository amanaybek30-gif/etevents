import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, Copy, Trash2, Plus, Edit, Users, Calendar, MapPin, CopyPlus } from "lucide-react";
import type { OrganizerSection } from "./OrganizerSidebar";
import ConfirmDialog from "@/components/ConfirmDialog";

interface EventRow {
  id: string; title: string; slug: string; date: string; location: string;
  is_published: boolean | null; ticket_price: string; category: string;
  image_url: string | null;
}

interface Props {
  userId: string;
  onNavigate: (section: OrganizerSection) => void;
  onEditEvent: (eventId: string) => void;
  isPaid?: boolean;
  onRequirePlan?: () => void;
}

const OrganizerEvents = ({ userId, onNavigate, onEditEvent, isPaid = true, onRequirePlan }: Props) => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [regCounts, setRegCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const fetchEvents = async () => {
    const { data } = await supabase.from("events")
      .select("id, title, slug, date, location, is_published, ticket_price, category, image_url")
      .eq("organizer_id", userId).order("date", { ascending: false });
    if (data) {
      setEvents(data);
      // Fetch reg counts
      const ids = data.map(e => e.id);
      if (ids.length > 0) {
        const { data: regs } = await supabase.from("registrations").select("event_id").in("event_id", ids);
        if (regs) {
          const counts: Record<string, number> = {};
          regs.forEach(r => { counts[r.event_id] = (counts[r.event_id] || 0) + 1; });
          setRegCounts(counts);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, [userId]);

  const deleteEvent = async () => {
    if (!deleteTarget) return;
    if (!isPaid) { onRequirePlan?.(); setDeleteTarget(null); return; }
    const { error } = await supabase.from("events").delete().eq("id", deleteTarget.id).eq("organizer_id", userId);
    if (error) { toast.error("Failed to delete"); setDeleteTarget(null); return; }
    toast.success("Event deleted");
    setDeleteTarget(null);
    fetchEvents();
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/event/${slug}`);
    toast.success("Link copied!");
  };

  const cloneEvent = async (eventId: string) => {
    if (!isPaid) { onRequirePlan?.(); return; }
    const { data: original } = await supabase.from("events").select("*").eq("id", eventId).single();
    if (!original) { toast.error("Event not found"); return; }

    const { id, slug, created_at, updated_at, is_published, ...rest } = original as any;
    const newSlug = `${slug}-copy-${Date.now().toString(36)}`;
    const { error } = await supabase.from("events").insert({
      ...rest,
      slug: newSlug,
      title: `${rest.title} (Copy)`,
      is_published: false,
      organizer_id: userId,
    });
    if (error) { toast.error("Failed to clone event"); return; }
    toast.success("Event cloned! Edit the copy to update details.");
    fetchEvents();
  };

  const statusBadge = (published: boolean | null) => {
    if (published) return <span className="inline-flex rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-500">Published</span>;
    return <span className="inline-flex rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-semibold text-yellow-500">Draft</span>;
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading events...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{events.length} event{events.length !== 1 ? "s" : ""}</p>
        <Button onClick={() => onNavigate("create-event")} className="bg-gradient-gold text-primary-foreground hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" /> Create Event
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No events yet. Create your first event!</p>
          <Button onClick={() => onNavigate("create-event")} className="bg-gradient-gold text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" /> Create Event
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(e => (
            <div key={e.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {e.image_url && (
                  <img src={e.image_url} alt={e.title} className="h-16 w-24 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-base font-bold text-foreground truncate">{e.title}</h3>
                    {statusBadge(e.is_published)}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {e.date}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {e.location}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {regCounts[e.id] || 0} registrations</span>
                    <span className="text-primary font-medium">{e.ticket_price}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => window.open(`/event/${e.slug}`, '_blank')}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onEditEvent(e.id)} className="h-8 px-2">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => copyLink(e.slug)} className="h-8 px-2">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => cloneEvent(e.id)} className="h-8 px-2" title="Clone Event">
                    <CopyPlus className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget({ id: e.id, title: e.title })} className="h-8 px-2 text-destructive hover:text-destructive/80">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Event"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        onConfirm={deleteEvent}
      />
    </div>
  );
};

export default OrganizerEvents;

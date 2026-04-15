import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Eye, Globe, EyeOff, Trash2, Search, Calendar, Users, CreditCard, X, ShieldAlert, ShieldCheck } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";

interface EventRow {
  id: string; title: string; slug: string; date: string; time: string;
  location: string; category: string; ticket_price: string;
  is_published: boolean | null; organizer_id: string | null;
  created_at: string;
}

interface OrganizerPaymentInfo {
  user_id: string;
  subscription_paid: boolean | null;
  subscription_plan: string;
  organization_name: string;
}

interface Props { searchQuery: string; }

const AdminEvents = ({ searchQuery }: Props) => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);
  const [eventStats, setEventStats] = useState<{ regs: number; approved: number; pending: number }>({ regs: 0, approved: 0, pending: 0 });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [organizerMap, setOrganizerMap] = useState<Record<string, OrganizerPaymentInfo>>({});

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("id, title, slug, date, time, location, category, ticket_price, is_published, organizer_id, created_at").order("created_at", { ascending: false });
    if (data) {
      setEvents(data);
      // Fetch organizer payment info
      const orgIds = [...new Set(data.map(e => e.organizer_id).filter(Boolean))] as string[];
      if (orgIds.length > 0) {
        const { data: profiles } = await supabase.from("organizer_profiles").select("user_id, subscription_paid, subscription_plan, organization_name").in("user_id", orgIds);
        if (profiles) {
          const map: Record<string, OrganizerPaymentInfo> = {};
          profiles.forEach(p => { map[p.user_id] = p; });
          setOrganizerMap(map);
        }
      }
    }
  };

  const togglePublish = async (id: string, published: boolean) => {
    const { error } = await supabase.from("events").update({ is_published: !published }).eq("id", id);
    if (error) { toast.error("Failed"); return; }
    toast.success(published ? "Unpublished" : "Published");
    fetchEvents();
  };

  const suspendEvent = async (event: EventRow) => {
    const { error } = await supabase.from("events").update({ is_published: false }).eq("id", event.id);
    if (error) { toast.error("Failed to suspend"); return; }
    await supabase.from("admin_logs").insert({
      admin_id: (await supabase.auth.getUser()).data.user?.id || "",
      action: "suspend_event",
      target_type: "event",
      target_id: event.id,
      details: `Suspended event "${event.title}" — organizer has not paid subscription.`,
    });
    toast.success(`Event "${event.title}" suspended`);
    fetchEvents();
    if (selectedEvent?.id === event.id) setSelectedEvent(null);
  };

  const unsuspendEvent = async (event: EventRow) => {
    const { error } = await supabase.from("events").update({ is_published: true }).eq("id", event.id);
    if (error) { toast.error("Failed to unsuspend"); return; }
    await supabase.from("admin_logs").insert({
      admin_id: (await supabase.auth.getUser()).data.user?.id || "",
      action: "unsuspend_event",
      target_type: "event",
      target_id: event.id,
      details: `Unsuspended event "${event.title}" — organizer subscription confirmed.`,
    });
    toast.success(`Event "${event.title}" published`);
    fetchEvents();
    if (selectedEvent?.id === event.id) setSelectedEvent(null);
  };

  const deleteEvent = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("events").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Failed to delete"); setDeleteTarget(null); return; }
    toast.success("Event deleted");
    setDeleteTarget(null);
    fetchEvents();
  };

  const viewEventDetail = async (event: EventRow) => {
    setSelectedEvent(event);
    const [regsRes, approvedRes, pendingRes] = await Promise.all([
      supabase.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id),
      supabase.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("status", "approved"),
      supabase.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("status", "pending"),
    ]);
    setEventStats({ regs: regsRes.count ?? 0, approved: approvedRes.count ?? 0, pending: pendingRes.count ?? 0 });
  };

  const getOrganizerPaidStatus = (organizerId: string | null): boolean | null => {
    if (!organizerId) return null;
    return organizerMap[organizerId]?.subscription_paid ?? null;
  };

  const now = new Date();
  const filtered = events.filter(e => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!e.title.toLowerCase().includes(q) && !e.slug.toLowerCase().includes(q)) return false;
    }
    if (statusFilter === "active") return new Date(e.date) >= now && e.is_published;
    if (statusFilter === "upcoming") return new Date(e.date) > now;
    if (statusFilter === "completed") return new Date(e.date) < now;
    if (statusFilter === "unpublished") return !e.is_published;
    if (statusFilter === "unpaid") return !getOrganizerPaidStatus(e.organizer_id);
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Events</h1>
        <p className="text-sm text-muted-foreground">{events.length} total</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 border-border bg-secondary"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="unpublished">Unpublished</SelectItem>
            <SelectItem value="unpaid">Unpaid Organizers</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setSelectedEvent(null)}>
          <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedEvent(null)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            <h2 className="font-display text-xl font-bold text-foreground">{selectedEvent.title}</h2>
            
            {/* Organizer payment status */}
            {selectedEvent.organizer_id && organizerMap[selectedEvent.organizer_id] && (
              <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${organizerMap[selectedEvent.organizer_id].subscription_paid ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
                {organizerMap[selectedEvent.organizer_id].subscription_paid ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                <span>
                  {organizerMap[selectedEvent.organizer_id].organization_name} — {organizerMap[selectedEvent.organizer_id].subscription_paid ? `Paid (${organizerMap[selectedEvent.organizer_id].subscription_plan})` : "Not Paid"}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Date:</span> <span className="text-foreground">{selectedEvent.date}</span></div>
              <div><span className="text-muted-foreground">Time:</span> <span className="text-foreground">{selectedEvent.time}</span></div>
              <div><span className="text-muted-foreground">Location:</span> <span className="text-foreground">{selectedEvent.location}</span></div>
              <div><span className="text-muted-foreground">Category:</span> <span className="text-foreground">{selectedEvent.category}</span></div>
              <div><span className="text-muted-foreground">Price:</span> <span className="text-foreground">{selectedEvent.ticket_price}</span></div>
              <div><span className="text-muted-foreground">Status:</span> <span className={selectedEvent.is_published ? "text-green-500" : "text-yellow-500"}>{selectedEvent.is_published ? "Published" : "Draft"}</span></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-secondary p-3 text-center">
                <Users className="mx-auto h-4 w-4 text-primary mb-1" />
                <p className="text-lg font-bold text-foreground">{eventStats.regs}</p>
                <p className="text-xs text-muted-foreground">Total Regs</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary p-3 text-center">
                <CreditCard className="mx-auto h-4 w-4 text-green-500 mb-1" />
                <p className="text-lg font-bold text-foreground">{eventStats.approved}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary p-3 text-center">
                <Calendar className="mx-auto h-4 w-4 text-yellow-500 mb-1" />
                <p className="text-lg font-bold text-foreground">{eventStats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild variant="outline" size="sm"><Link to={`/event/${selectedEvent.slug}`}><Eye className="mr-1 h-3 w-3" /> View Page</Link></Button>
              <Button size="sm" variant="outline" onClick={() => { togglePublish(selectedEvent.id, !!selectedEvent.is_published); setSelectedEvent(null); }}>
                {selectedEvent.is_published ? <><EyeOff className="mr-1 h-3 w-3" /> Unpublish</> : <><Globe className="mr-1 h-3 w-3" /> Publish</>}
              </Button>
              {/* Suspend / Unsuspend based on payment */}
              {selectedEvent.is_published && !getOrganizerPaidStatus(selectedEvent.organizer_id) && (
                <Button size="sm" variant="destructive" onClick={() => suspendEvent(selectedEvent)}>
                  <ShieldAlert className="mr-1 h-3 w-3" /> Suspend (Unpaid)
                </Button>
              )}
              {!selectedEvent.is_published && getOrganizerPaidStatus(selectedEvent.organizer_id) && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => unsuspendEvent(selectedEvent)}>
                  <ShieldCheck className="mr-1 h-3 w-3" /> Unsuspend
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary">
            <tr>{["Event Name", "Category", "Date", "Status", "Organizer Paid", "Price", "Actions"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map(e => {
              const paid = getOrganizerPaidStatus(e.organizer_id);
              return (
                <tr key={e.id} className="border-b border-border hover:bg-secondary/50 cursor-pointer transition-colors" onClick={() => viewEventDetail(e)}>
                  <td className="px-4 py-3 font-medium text-foreground">{e.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.category}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.date}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${e.is_published ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"}`}>
                      {e.is_published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {paid === null ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : paid ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-500"><ShieldCheck className="h-3 w-3" /> Paid</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive"><ShieldAlert className="h-3 w-3" /> Unpaid</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.ticket_price}</td>
                  <td className="px-4 py-3" onClick={ev => ev.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => togglePublish(e.id, !!e.is_published)} className={`h-7 w-7 p-0 ${e.is_published ? "text-green-500" : "text-muted-foreground"}`}>
                        {e.is_published ? <Globe className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </Button>
                      {/* Quick suspend for unpaid published events */}
                      {e.is_published && paid === false && (
                        <Button size="sm" variant="ghost" onClick={() => suspendEvent(e)} className="h-7 w-7 p-0 text-destructive hover:text-destructive/80" title="Suspend — organizer unpaid">
                          <ShieldAlert className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {/* Quick unsuspend for paid unpublished events */}
                      {!e.is_published && paid === true && (
                        <Button size="sm" variant="ghost" onClick={() => unsuspendEvent(e)} className="h-7 w-7 p-0 text-green-500 hover:text-green-600" title="Unsuspend — organizer paid">
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" asChild className="h-7 w-7 p-0 text-muted-foreground hover:text-primary">
                        <Link to={`/event/${e.slug}`}><Eye className="h-3.5 w-3.5" /></Link>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget({ id: e.id, title: e.title })} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No events found.</td></tr>}
          </tbody>
        </table>
      </div>

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

export default AdminEvents;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, Calendar, CheckCircle, XCircle, Trash2, Ban, PlayCircle, UserX } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Organizer {
  id: string; organization_name: string; email: string | null; phone: string | null;
  user_id: string; created_at: string; eventCount?: number;
  subscription_paid: boolean | null; subscription_expires_at: string | null;
  subscription_plan: string; is_suspended: boolean | null;
}

interface Attendee {
  full_name: string; email: string; phone: string; eventsAttended: number;
}

interface ExplorerAccount {
  id: string; user_id: string; full_name: string; email: string;
  phone: string | null; bio: string | null; created_at: string;
  isSuspended?: boolean;
}

interface Props { searchQuery: string; }

const PLAN_LABELS: Record<string, string> = {
  free: "Free", organizer: "Organizer", pro: "Pro", corporate: "Corporate",
};

const AdminUsers = ({ searchQuery }: Props) => {
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [explorers, setExplorers] = useState<ExplorerAccount[]>([]);
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Organizer | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Organizer | null>(null);
  const [deleteExplorerTarget, setDeleteExplorerTarget] = useState<ExplorerAccount | null>(null);
  const [deactivateExplorerTarget, setDeactivateExplorerTarget] = useState<ExplorerAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchOrganizers(); fetchAttendees(); fetchExplorers(); checkSubscription(); }, []);

  const checkSubscription = async () => {
    const { data } = await supabase.from("platform_settings").select("key, value").eq("key", "subscription_enabled").single();
    if (data) setSubscriptionEnabled(data.value === "true");
  };

  const fetchOrganizers = async () => {
    const { data: profiles } = await supabase.from("organizer_profiles").select("*").order("created_at", { ascending: false });
    if (!profiles) return;
    const { data: events } = await supabase.from("events").select("organizer_id");
    const countMap: Record<string, number> = {};
    events?.forEach(e => { if (e.organizer_id) countMap[e.organizer_id] = (countMap[e.organizer_id] || 0) + 1; });
    setOrganizers(profiles.map((p: any) => ({ ...p, eventCount: countMap[p.user_id] || 0 })));
  };

  const fetchAttendees = async () => {
    const { data: regs } = await supabase.from("registrations").select("full_name, email, phone, event_id");
    if (!regs) return;
    const map: Record<string, Attendee> = {};
    regs.forEach(r => {
      if (!map[r.email]) map[r.email] = { full_name: r.full_name, email: r.email, phone: r.phone, eventsAttended: 0 };
      map[r.email].eventsAttended++;
    });
    setAttendees(Object.values(map).sort((a, b) => b.eventsAttended - a.eventsAttended));
  };

  const fetchExplorers = async () => {
    const { data: accounts } = await supabase
      .from("attendee_accounts")
      .select("id, user_id, full_name, email, phone, bio, created_at")
      .order("created_at", { ascending: false });
    if (!accounts) return;

    // Check which are suspended (in banned_emails)
    const { data: banned } = await supabase.from("banned_emails").select("email") as any;
    const bannedSet = new Set((banned || []).map((b: any) => b.email?.toLowerCase()));

    setExplorers(accounts.map((a: any) => ({
      ...a,
      isSuspended: bannedSet.has(a.email?.toLowerCase()),
    })));
  };

  // Organizer actions
  const toggleSuspend = async (org: Organizer) => {
    const newSuspended = !org.is_suspended;
    const { error } = await supabase.from("organizer_profiles").update({ is_suspended: newSuspended }).eq("id", org.id);
    if (error) { toast.error("Failed to update"); return; }
    if (newSuspended) {
      if (org.email) {
        await supabase.from("banned_emails").insert({ email: org.email, phone: org.phone, reason: "Account suspended by admin" } as any);
      }
      toast.success(`"${org.organization_name}" has been suspended.`);
    } else {
      if (org.email) {
        await supabase.from("banned_emails").delete().eq("email", org.email) as any;
      }
      toast.success(`"${org.organization_name}" has been unsuspended.`);
    }
    fetchOrganizers();
  };

  const deleteAuthUser = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { user_id: userId },
    });
    if (error) throw new Error("Failed to remove auth record: " + error.message);
    if (data?.error) throw new Error(data.error);
  };

  const handleDeactivateOrganizer = async () => {
    if (!deactivateTarget) return;
    setDeleting(true);
    try {
      // Deactivate = permanent ban, can never sign up with same email
      if (deactivateTarget.email) {
        await supabase.from("banned_emails" as any).insert({ email: deactivateTarget.email, phone: deactivateTarget.phone, reason: "Account deactivated by admin" } as any);
      }
      await supabase.from("events").delete().eq("organizer_id", deactivateTarget.user_id);
      await supabase.from("organizer_profiles").delete().eq("id", deactivateTarget.id);
      await supabase.from("user_roles").delete().eq("user_id", deactivateTarget.user_id);
      await deleteAuthUser(deactivateTarget.user_id);
      toast.success(`"${deactivateTarget.organization_name}" has been deactivated. They cannot sign up again with the same email.`);
      setDeactivateTarget(null);
      fetchOrganizers();
    } catch (err: any) {
      toast.error("Failed to deactivate: " + (err.message || "Unknown error"));
    }
    setDeleting(false);
  };

  const handleDeleteOrganizer = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Delete = full removal, can sign up again as new user
      await supabase.from("events").delete().eq("organizer_id", deleteTarget.user_id);
      await supabase.from("organizer_profiles").delete().eq("id", deleteTarget.id);
      await supabase.from("user_roles").delete().eq("user_id", deleteTarget.user_id);
      // Remove from banned_emails in case they were previously suspended
      if (deleteTarget.email) {
        await supabase.from("banned_emails").delete().eq("email", deleteTarget.email) as any;
      }
      await deleteAuthUser(deleteTarget.user_id);
      toast.success(`Organizer "${deleteTarget.organization_name}" has been deleted. They can sign up again as a new user.`);
      setDeleteTarget(null);
      fetchOrganizers();
    } catch (err: any) {
      toast.error("Failed to delete: " + (err.message || "Unknown error"));
    }
    setDeleting(false);
  };

  // Explorer actions
  const toggleExplorerSuspend = async (explorer: ExplorerAccount) => {
    if (explorer.isSuspended) {
      await supabase.from("banned_emails").delete().eq("email", explorer.email) as any;
      toast.success(`"${explorer.full_name}" has been unsuspended.`);
    } else {
      await supabase.from("banned_emails").insert({ email: explorer.email, phone: explorer.phone, reason: "Account suspended by admin" } as any);
      toast.success(`"${explorer.full_name}" has been suspended. They cannot sign in.`);
    }
    fetchExplorers();
  };

  const handleDeactivateExplorer = async () => {
    if (!deactivateExplorerTarget) return;
    setDeleting(true);
    try {
      // Deactivate = permanent ban
      await supabase.from("banned_emails" as any).insert({ email: deactivateExplorerTarget.email, phone: deactivateExplorerTarget.phone, reason: "Account deactivated by admin" } as any);
      await supabase.from("attendee_accounts").delete().eq("id", deactivateExplorerTarget.id);
      await supabase.from("user_roles").delete().eq("user_id", deactivateExplorerTarget.user_id);
      await supabase.from("saved_events").delete().eq("user_id", deactivateExplorerTarget.user_id);
      await deleteAuthUser(deactivateExplorerTarget.user_id);
      toast.success(`"${deactivateExplorerTarget.full_name}" has been deactivated. They cannot sign up again with the same email.`);
      setDeactivateExplorerTarget(null);
      fetchExplorers();
    } catch (err: any) {
      toast.error("Failed to deactivate: " + (err.message || "Unknown error"));
    }
    setDeleting(false);
  };

  const handleDeleteExplorer = async () => {
    if (!deleteExplorerTarget) return;
    setDeleting(true);
    try {
      // Delete = full removal, can sign up again
      await supabase.from("attendee_accounts").delete().eq("id", deleteExplorerTarget.id);
      await supabase.from("user_roles").delete().eq("user_id", deleteExplorerTarget.user_id);
      await supabase.from("saved_events").delete().eq("user_id", deleteExplorerTarget.user_id);
      // Remove from banned_emails in case they were previously suspended
      await supabase.from("banned_emails").delete().eq("email", deleteExplorerTarget.email) as any;
      await deleteAuthUser(deleteExplorerTarget.user_id);
      toast.success(`"${deleteExplorerTarget.full_name}" has been deleted. They can sign up again as a new user.`);
      setDeleteExplorerTarget(null);
      fetchExplorers();
    } catch (err: any) {
      toast.error("Failed to delete: " + (err.message || "Unknown error"));
    }
    setDeleting(false);
  };

  const q = searchQuery.toLowerCase();
  const filteredOrgs = organizers.filter(o => !q || o.organization_name.toLowerCase().includes(q) || (o.email && o.email.toLowerCase().includes(q)) || (o.phone && o.phone.includes(q)));
  const filteredAtts = attendees.filter(a => !q || a.full_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
  const filteredExplorers = explorers.filter(e => !q || e.full_name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || (e.phone && e.phone.includes(q)));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Users</h1>

      <Tabs defaultValue="organizers">
        <TabsList className="bg-secondary">
          <TabsTrigger value="organizers">Organizers ({organizers.length})</TabsTrigger>
          <TabsTrigger value="explorers">Explorers ({explorers.length})</TabsTrigger>
          <TabsTrigger value="attendees">Attendees ({attendees.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="organizers" className="mt-4">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary">
                <tr>
                  {["Name", "Email", "Phone", "Plan", "Events", "Joined", ...(subscriptionEnabled ? ["Status"] : []), "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.map(o => (
                  <tr key={o.id} className={`border-b border-border hover:bg-secondary/50 ${o.is_suspended ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {o.organization_name}
                      {o.is_suspended && <span className="ml-2 inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">Suspended</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{o.email || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {PLAN_LABELS[o.subscription_plan] || o.subscription_plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><Calendar className="h-3 w-3" /> {o.eventCount}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                    {subscriptionEnabled && (
                      <td className="px-4 py-3">
                        {o.subscription_paid ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-400">
                            <CheckCircle className="h-3 w-3" /> Active
                            {o.subscription_expires_at && <span className="text-muted-foreground ml-1">(until {new Date(o.subscription_expires_at).toLocaleDateString()})</span>}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-destructive"><XCircle className="h-3 w-3" /> Unpaid</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button size="sm" variant="ghost" onClick={() => toggleSuspend(o)}
                          className={`h-7 text-xs ${o.is_suspended ? "text-green-400 hover:text-green-300" : "text-amber-400 hover:text-amber-300"}`}>
                          {o.is_suspended ? <><PlayCircle className="h-3 w-3 mr-1" /> Unsuspend</> : <><Ban className="h-3 w-3 mr-1" /> Suspend</>}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeactivateTarget(o)} className="h-7 text-xs text-orange-400 hover:text-orange-300">
                          <UserX className="h-3 w-3 mr-1" /> Deactivate
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(o)} className="h-7 text-xs text-destructive hover:text-destructive/80">
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredOrgs.length === 0 && <tr><td colSpan={subscriptionEnabled ? 8 : 7} className="px-4 py-12 text-center text-muted-foreground">No organizers found.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Explorers Tab */}
        <TabsContent value="explorers" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">Users who signed up to explore and browse events.</p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary">
                <tr>{["Name", "Email", "Phone", "Joined", "Actions"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filteredExplorers.map(e => (
                  <tr key={e.id} className={`border-b border-border hover:bg-secondary/50 ${e.isSuspended ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {e.full_name}
                      {e.isSuspended && <span className="ml-2 inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">Suspended</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{e.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.phone || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(e.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button size="sm" variant="ghost" onClick={() => toggleExplorerSuspend(e)}
                          className={`h-7 text-xs ${e.isSuspended ? "text-green-400 hover:text-green-300" : "text-amber-400 hover:text-amber-300"}`}>
                          {e.isSuspended ? <><PlayCircle className="h-3 w-3 mr-1" /> Unsuspend</> : <><Ban className="h-3 w-3 mr-1" /> Suspend</>}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeactivateExplorerTarget(e)} className="h-7 text-xs text-orange-400 hover:text-orange-300">
                          <UserX className="h-3 w-3 mr-1" /> Deactivate
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteExplorerTarget(e)} className="h-7 text-xs text-destructive hover:text-destructive/80">
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredExplorers.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No explorer accounts found.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="attendees" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">People who have registered for events (from registrations).</p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary">
                <tr>{["Name", "Email", "Phone", "Events Attended"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filteredAtts.map((a, i) => (
                  <tr key={i} className="border-b border-border hover:bg-secondary/50">
                    <td className="px-4 py-3 font-medium text-foreground">{a.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.phone}</td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-muted-foreground"><Users className="h-3 w-3" /> {a.eventsAttended}</span></td>
                  </tr>
                ))}
                {filteredAtts.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">No attendees found.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Organizer Confirm Dialogs */}
      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={open => { if (!open) setDeactivateTarget(null); }}
        title="Deactivate Organizer"
        description={`Are you sure you want to deactivate "${deactivateTarget?.organization_name}"? Their account will be permanently banned. They will NOT be able to sign up again with the same email.`}
        confirmLabel="Deactivate"
        onConfirm={handleDeactivateOrganizer}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => { if (!open) setDeleteTarget(null); }}
        title="Delete Organizer"
        description={`Are you sure you want to delete "${deleteTarget?.organization_name}"? Their account, events, and login history will be fully erased. They CAN sign up again as a new user.`}
        onConfirm={handleDeleteOrganizer}
      />

      {/* Explorer Confirm Dialogs */}
      <ConfirmDialog
        open={!!deactivateExplorerTarget}
        onOpenChange={open => { if (!open) setDeactivateExplorerTarget(null); }}
        title="Deactivate Explorer Account"
        description={`Are you sure you want to deactivate "${deactivateExplorerTarget?.full_name}"? Their account will be permanently banned. They will NOT be able to sign up again with the same email.`}
        confirmLabel="Deactivate"
        onConfirm={handleDeactivateExplorer}
      />
      <ConfirmDialog
        open={!!deleteExplorerTarget}
        onOpenChange={open => { if (!open) setDeleteExplorerTarget(null); }}
        title="Delete Explorer"
        description={`Are you sure you want to delete "${deleteExplorerTarget?.full_name}"? Their account and login history will be fully erased. They CAN sign up again as a new user.`}
        onConfirm={handleDeleteExplorer}
      />
    </div>
  );
};

export default AdminUsers;

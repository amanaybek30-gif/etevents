import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CreditCard, Check, X, Clock, Eye, Ban, RefreshCw, Loader2,
  Crown, Zap, Building2, Search, ExternalLink, Edit2, Save, Package, Plus, Trash2
} from "lucide-react";

interface Props {
  searchQuery: string;
  adminId: string;
}

interface Payment {
  id: string;
  organizer_id: string;
  plan: string;
  amount: number;
  addons: any;
  transaction_number: string | null;
  receipt_url: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface OrgProfile {
  id: string;
  user_id: string;
  organization_name: string;
  email: string | null;
  phone: string | null;
  subscription_plan: string;
  subscription_paid: boolean | null;
  subscription_expires_at: string | null;
  is_suspended: boolean | null;
  created_at: string;
}

const PLAN_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  organizer: { label: "Organizer", icon: Zap, color: "text-blue-500" },
  pro: { label: "Pro", icon: Crown, color: "text-amber-500" },
  corporate: { label: "Corporate", icon: Building2, color: "text-purple-500" },
  free: { label: "Free", icon: CreditCard, color: "text-muted-foreground" },
};

interface PlanConfig {
  id: string;
  name: string;
  price: number;
  features: string[];
  registrationLimit: number | null;
}

const DEFAULT_PLANS: PlanConfig[] = [
  { id: "organizer", name: "Organizer", price: 1800, features: ["Up to 100 registrations", "QR code check-in", "Basic analytics", "Registration data export", "Email confirmations"], registrationLimit: 100 },
  { id: "pro", name: "Pro Organizer", price: 6500, features: ["Up to 300 registrations", "Checked-in data export", "Advanced analytics", "Survey form (QR)", "1 check-in staff"], registrationLimit: 300 },
  { id: "corporate", name: "Corporate", price: 10500, features: ["Unlimited registrations", "Advanced reporting", "Attendee Intelligence CRM", "Survey (QR + email)"], registrationLimit: null },
];

interface UpgradeOffer {
  from: string;
  to: string;
  discountPrice: number;
  fullPrice: number;
  discountWindowDays: number;
}

const DEFAULT_UPGRADES: UpgradeOffer[] = [
  { from: "organizer", to: "pro", discountPrice: 5000, fullPrice: 6500, discountWindowDays: 7 },
  { from: "pro", to: "corporate", discountPrice: 4500, fullPrice: 10500, discountWindowDays: 7 },
];

const AdminSubscriptions = ({ searchQuery, adminId }: Props) => {
  const [tab, setTab] = useState("pending");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [organizers, setOrganizers] = useState<OrgProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [newPlan, setNewPlan] = useState("");
  const [newExpiry, setNewExpiry] = useState("");

  // Plan editing state
  const [plans, setPlans] = useState<PlanConfig[]>(DEFAULT_PLANS);
  const [upgrades, setUpgrades] = useState<UpgradeOffer[]>(DEFAULT_UPGRADES);
  const [editingPlans, setEditingPlans] = useState(false);
  const [savingPlans, setSavingPlans] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [paymentsRes, orgsRes, plansRes, upgradesRes] = await Promise.all([
      supabase.from("subscription_payments").select("*").order("created_at", { ascending: false }),
      supabase.from("organizer_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("platform_settings").select("key, value").eq("key", "subscription_plans"),
      supabase.from("platform_settings").select("key, value").eq("key", "upgrade_offers"),
    ]);
    setPayments((paymentsRes.data as any[]) || []);
    setOrganizers(orgsRes.data || []);
    if (plansRes.data?.[0]) {
      try { setPlans(JSON.parse(plansRes.data[0].value)); } catch { }
    }
    if (upgradesRes.data?.[0]) {
      try { setUpgrades(JSON.parse(upgradesRes.data[0].value)); } catch { }
    }
    setLoading(false);
  };

  const getOrgName = (orgId: string) => {
    const org = organizers.find(o => o.user_id === orgId);
    return org?.organization_name || "Unknown";
  };

  const getOrgEmail = (orgId: string) => {
    const org = organizers.find(o => o.user_id === orgId);
    return org?.email || "—";
  };

  const approvePayment = async (payment: Payment) => {
    // Corporate plan: strictly 2 months from approval date
    // Other plans: event-bound (will be extended when events are created)
    const now = new Date();
    let expiresAt: string;
    if (payment.plan === "corporate") {
      const expiry = new Date(now);
      expiry.setMonth(expiry.getMonth() + 2);
      expiresAt = expiry.toISOString();
    } else {
      // For organizer/pro: set initial grace period, actual expiry set when event is created
      const expiry = new Date(now);
      expiry.setDate(expiry.getDate() + 30); // initial 30-day window to create an event
      expiresAt = expiry.toISOString();
    }
    const [updatePayment, updateProfile] = await Promise.all([
      supabase.from("subscription_payments").update({
        status: "approved",
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        admin_notes: editNotes[payment.id] || payment.admin_notes,
        updated_at: new Date().toISOString(),
      }).eq("id", payment.id),
      supabase.from("organizer_profiles").update({
        subscription_paid: true,
        subscription_expires_at: expiresAt,
        subscription_plan: payment.plan,
      }).eq("user_id", payment.organizer_id),
    ]);

    if (updatePayment.error || updateProfile.error) {
      toast.error("Failed to approve payment");
      return;
    }

    await supabase.from("admin_logs").insert({
      admin_id: adminId,
      action: "approve_subscription",
      target_type: "subscription_payment",
      target_id: payment.id,
      details: `Approved ${payment.plan} plan for ${getOrgName(payment.organizer_id)}`,
    });

    toast.success(`Payment approved for ${getOrgName(payment.organizer_id)}`);
    fetchAll();
  };

  const rejectPayment = async (payment: Payment) => {
    await supabase.from("subscription_payments").update({
      status: "rejected",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      admin_notes: editNotes[payment.id] || payment.admin_notes || "Payment rejected",
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id);

    await supabase.from("admin_logs").insert({
      admin_id: adminId,
      action: "reject_subscription",
      target_type: "subscription_payment",
      target_id: payment.id,
      details: `Rejected payment for ${getOrgName(payment.organizer_id)}`,
    });

    toast.success("Payment rejected");
    fetchAll();
  };

  const removePlan = async (org: OrgProfile) => {
    await supabase.from("organizer_profiles").update({
      subscription_paid: false,
      subscription_plan: "free",
      subscription_expires_at: null,
    }).eq("user_id", org.user_id);

    await supabase.from("admin_logs").insert({
      admin_id: adminId,
      action: "remove_plan",
      target_type: "organizer",
      target_id: org.user_id,
      details: `Removed paid plan for ${org.organization_name} (was ${org.subscription_plan})`,
    });

    toast.success(`${org.organization_name}'s paid plan has been removed`);
    fetchAll();
  };

  const savePlanEdit = async (org: OrgProfile) => {
    const updates: any = {};
    if (newPlan) updates.subscription_plan = newPlan;
    if (newExpiry) updates.subscription_expires_at = new Date(newExpiry).toISOString();

    await supabase.from("organizer_profiles").update(updates).eq("user_id", org.user_id);

    await supabase.from("admin_logs").insert({
      admin_id: adminId,
      action: "edit_subscription",
      target_type: "organizer",
      target_id: org.user_id,
      details: `Updated plan to ${newPlan || org.subscription_plan} for ${org.organization_name}`,
    });

    toast.success("Subscription updated");
    setEditingPlan(null);
    setNewPlan("");
    setNewExpiry("");
    fetchAll();
  };

  const savePlansConfig = async () => {
    setSavingPlans(true);
    try {
      const { data: existingPlans } = await supabase.from("platform_settings").select("id").eq("key", "subscription_plans").single();
      if (existingPlans) {
        await supabase.from("platform_settings").update({ value: JSON.stringify(plans), updated_at: new Date().toISOString() }).eq("key", "subscription_plans");
      } else {
        await supabase.from("platform_settings").insert({ key: "subscription_plans", value: JSON.stringify(plans) });
      }
      const { data: existingUpgrades } = await supabase.from("platform_settings").select("id").eq("key", "upgrade_offers").single();
      if (existingUpgrades) {
        await supabase.from("platform_settings").update({ value: JSON.stringify(upgrades), updated_at: new Date().toISOString() }).eq("key", "upgrade_offers");
      } else {
        await supabase.from("platform_settings").insert({ key: "upgrade_offers", value: JSON.stringify(upgrades) });
      }
      await supabase.from("admin_logs").insert({
        admin_id: adminId, action: "update_plans", target_type: "platform_settings", details: "Updated subscription plans and upgrade offers",
      });
      toast.success("Plans & offers saved successfully");
      setEditingPlans(false);
    } catch { toast.error("Failed to save"); }
    setSavingPlans(false);
  };

  const viewReceiptUrl = async (url: string) => {
    const { data } = await supabase.storage.from("subscription-receipts").createSignedUrl(url, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Could not load receipt");
    }
  };

  const pendingPayments = payments.filter(p => p.status === "pending");
  const allPayments = payments;
  const activeOrgs = organizers.filter(o => o.subscription_paid && !o.is_suspended);
  const suspendedOrgs = organizers.filter(o => o.is_suspended);

  const filteredPayments = (list: Payment[]) => {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(p =>
      getOrgName(p.organizer_id).toLowerCase().includes(q) ||
      p.plan.toLowerCase().includes(q) ||
      p.transaction_number?.toLowerCase().includes(q) ||
      p.status.toLowerCase().includes(q)
    );
  };

  const filteredOrgs = (list: OrgProfile[]) => {
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(o =>
      o.organization_name.toLowerCase().includes(q) ||
      o.email?.toLowerCase().includes(q) ||
      o.subscription_plan.toLowerCase().includes(q)
    );
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Subscription Management</h2>
          <p className="text-sm text-muted-foreground">Manage plans, approve payments, and control organizer access.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} className="border-border">
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{pendingPayments.length}</p>
          <p className="text-xs text-muted-foreground">Pending Approvals</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-primary">{activeOrgs.length}</p>
          <p className="text-xs text-muted-foreground">Active Subscriptions</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{suspendedOrgs.length}</p>
          <p className="text-xs text-muted-foreground">Suspended</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{organizers.length}</p>
          <p className="text-xs text-muted-foreground">Total Organizers</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary border border-border flex-wrap">
          <TabsTrigger value="pending" className="text-xs">
            Pending {pendingPayments.length > 0 && <Badge variant="destructive" className="ml-1 h-5 min-w-5 text-[10px]">{pendingPayments.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="text-xs">Active</TabsTrigger>
          <TabsTrigger value="all-payments" className="text-xs">All Payments</TabsTrigger>
          <TabsTrigger value="suspended" className="text-xs">Suspended</TabsTrigger>
          <TabsTrigger value="plans" className="text-xs"><Package className="h-3 w-3 mr-1" /> Plans & Offers</TabsTrigger>
        </TabsList>

        {/* Pending Approvals */}
        <TabsContent value="pending">
          {filteredPayments(pendingPayments).length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <Clock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No pending approvals</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="text-xs">Organization</TableHead>
                    <TableHead className="text-xs">Plan</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Transaction #</TableHead>
                    <TableHead className="text-xs">Receipt</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Notes</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments(pendingPayments).map(p => {
                    const meta = PLAN_META[p.plan] || PLAN_META.free;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <p className="text-sm font-medium text-foreground">{getOrgName(p.organizer_id)}</p>
                          <p className="text-xs text-muted-foreground">{getOrgEmail(p.organizer_id)}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs gap-1">
                            <meta.icon className={`h-3 w-3 ${meta.color}`} />
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-foreground">{p.amount.toLocaleString()} ETB</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{p.transaction_number || "—"}</TableCell>
                        <TableCell>
                          {p.receipt_url ? (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-primary" onClick={() => viewReceiptUrl(p.receipt_url!)}>
                              <Eye className="h-3 w-3 mr-1" /> View
                            </Button>
                          ) : <span className="text-xs text-muted-foreground">None</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Input
                            placeholder="Admin notes..."
                            value={editNotes[p.id] ?? p.admin_notes ?? ""}
                            onChange={e => setEditNotes(prev => ({ ...prev, [p.id]: e.target.value }))}
                            className="h-7 text-xs border-border bg-secondary min-w-[120px]"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" className="h-7 text-xs bg-primary text-primary-foreground" onClick={() => approvePayment(p)}>
                              <Check className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-destructive text-destructive" onClick={() => rejectPayment(p)}>
                              <X className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Active Subscribers */}
        <TabsContent value="subscribers">
          {filteredOrgs(activeOrgs).length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <CreditCard className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No active subscribers</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="text-xs">Organization</TableHead>
                    <TableHead className="text-xs">Plan</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Expires</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrgs(activeOrgs).map(org => {
                    const meta = PLAN_META[org.subscription_plan] || PLAN_META.free;
                    const isEditing = editingPlan === org.user_id;
                    return (
                      <TableRow key={org.id}>
                        <TableCell>
                          <p className="text-sm font-medium text-foreground">{org.organization_name}</p>
                          <p className="text-xs text-muted-foreground">{org.email || org.phone || "—"}</p>
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <select
                              value={newPlan || org.subscription_plan}
                              onChange={e => setNewPlan(e.target.value)}
                              className="h-7 rounded border border-border bg-secondary px-2 text-xs"
                            >
                              <option value="organizer">Organizer</option>
                              <option value="pro">Pro</option>
                              <option value="corporate">Corporate</option>
                            </select>
                          ) : (
                            <Badge variant="outline" className="text-xs gap-1">
                              <meta.icon className={`h-3 w-3 ${meta.color}`} />
                              {meta.label}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-primary/10 text-primary text-xs">Active</Badge>
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              type="date"
                              value={newExpiry || (org.subscription_expires_at ? new Date(org.subscription_expires_at).toISOString().split("T")[0] : "")}
                              onChange={e => setNewExpiry(e.target.value)}
                              className="h-7 text-xs border-border bg-secondary"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {org.subscription_expires_at ? new Date(org.subscription_expires_at).toLocaleDateString() : "—"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {isEditing ? (
                              <>
                                <Button size="sm" className="h-7 text-xs" onClick={() => savePlanEdit(org)}>
                                  <Save className="h-3 w-3 mr-1" /> Save
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs border-border" onClick={() => { setEditingPlan(null); setNewPlan(""); setNewExpiry(""); }}>
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" className="h-7 text-xs border-border" onClick={() => { setEditingPlan(org.user_id); setNewPlan(org.subscription_plan); }}>
                                  <Edit2 className="h-3 w-3 mr-1" /> Edit
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs border-destructive text-destructive" onClick={() => removePlan(org)}>
                                  <Ban className="h-3 w-3 mr-1" /> Remove Plan
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* All Payments */}
        <TabsContent value="all-payments">
          {filteredPayments(allPayments).length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <CreditCard className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No payment records yet</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="text-xs">Organization</TableHead>
                    <TableHead className="text-xs">Plan</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Transaction #</TableHead>
                    <TableHead className="text-xs">Receipt</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Admin Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments(allPayments).map(p => {
                    const meta = PLAN_META[p.plan] || PLAN_META.free;
                    const statusColor = p.status === "approved" ? "bg-primary/10 text-primary" : p.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600";
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <p className="text-sm font-medium text-foreground">{getOrgName(p.organizer_id)}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs gap-1">
                            <meta.icon className={`h-3 w-3 ${meta.color}`} />
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">{p.amount.toLocaleString()} ETB</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{p.transaction_number || "—"}</TableCell>
                        <TableCell>
                          {p.receipt_url ? (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-primary" onClick={() => viewReceiptUrl(p.receipt_url!)}>
                              <Eye className="h-3 w-3 mr-1" /> View
                            </Button>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs capitalize ${statusColor}`}>{p.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{p.admin_notes || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Suspended */}
        <TabsContent value="suspended">
          {filteredOrgs(suspendedOrgs).length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <Ban className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No suspended organizers</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="text-xs">Organization</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Plan</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrgs(suspendedOrgs).map(org => (
                    <TableRow key={org.id}>
                      <TableCell className="text-sm font-medium text-foreground">{org.organization_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{org.email || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground capitalize">{org.subscription_plan}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="h-7 text-xs border-primary text-primary" onClick={() => removePlan(org)}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Reactivate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Plans & Offers */}
        <TabsContent value="plans">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-foreground">Subscription Plans</h3>
              <div className="flex gap-2">
                {editingPlans ? (
                  <>
                    <Button size="sm" onClick={savePlansConfig} disabled={savingPlans} className="bg-primary text-primary-foreground">
                      {savingPlans ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Save All
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingPlans(false)} className="border-border">Cancel</Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditingPlans(true)} className="border-border">
                    <Edit2 className="h-3 w-3 mr-1" /> Edit Plans
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {plans.map((plan, idx) => (
                <div key={plan.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    {plan.id === "organizer" && <Zap className="h-5 w-5 text-blue-500" />}
                    {plan.id === "pro" && <Crown className="h-5 w-5 text-amber-500" />}
                    {plan.id === "corporate" && <Building2 className="h-5 w-5 text-purple-500" />}
                    {editingPlans ? (
                      <Input value={plan.name} onChange={e => {
                        const updated = [...plans]; updated[idx] = { ...plan, name: e.target.value }; setPlans(updated);
                      }} className="h-7 text-sm font-bold border-border bg-secondary" />
                    ) : (
                      <h4 className="font-display text-sm font-bold text-foreground">{plan.name}</h4>
                    )}
                  </div>
                  <div>
                    {editingPlans ? (
                      <div className="flex items-center gap-1">
                        <Input type="number" value={plan.price} onChange={e => {
                          const updated = [...plans]; updated[idx] = { ...plan, price: Number(e.target.value) }; setPlans(updated);
                        }} className="h-7 text-sm w-24 border-border bg-secondary" />
                        <span className="text-xs text-muted-foreground">ETB</span>
                      </div>
                    ) : (
                      <span className="text-xl font-bold text-foreground">{plan.price.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">ETB / event</span></span>
                    )}
                  </div>
                  <div>
                    {editingPlans ? (
                      <div className="flex items-center gap-1">
                        <Label className="text-xs">Reg. Limit:</Label>
                        <Input type="number" value={plan.registrationLimit ?? ""} placeholder="Unlimited"
                          onChange={e => {
                            const updated = [...plans];
                            updated[idx] = { ...plan, registrationLimit: e.target.value ? Number(e.target.value) : null };
                            setPlans(updated);
                          }} className="h-7 text-xs w-20 border-border bg-secondary" />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Limit: {plan.registrationLimit ? `${plan.registrationLimit} registrations` : "Unlimited"}</p>
                    )}
                  </div>
                  <ul className="space-y-1">
                    {plan.features.map((f, fi) => (
                      <li key={fi} className="flex items-start gap-2 text-xs text-muted-foreground">
                        {editingPlans ? (
                          <div className="flex items-center gap-1 w-full">
                            <Input value={f} onChange={e => {
                              const updated = [...plans];
                              const features = [...plan.features];
                              features[fi] = e.target.value;
                              updated[idx] = { ...plan, features };
                              setPlans(updated);
                            }} className="h-6 text-xs border-border bg-secondary flex-1" />
                            <button onClick={() => {
                              const updated = [...plans];
                              updated[idx] = { ...plan, features: plan.features.filter((_, i) => i !== fi) };
                              setPlans(updated);
                            }} className="text-destructive hover:text-destructive/80"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        ) : (
                          <><Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> {f}</>
                        )}
                      </li>
                    ))}
                    {editingPlans && (
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-primary" onClick={() => {
                        const updated = [...plans];
                        updated[idx] = { ...plan, features: [...plan.features, "New feature"] };
                        setPlans(updated);
                      }}><Plus className="h-3 w-3 mr-1" /> Add feature</Button>
                    )}
                  </ul>
                </div>
              ))}
            </div>

            {/* Upgrade Offers */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="font-display text-base font-bold text-foreground">Upgrade Offers</h3>
              <p className="text-xs text-muted-foreground">Discounted upgrade pricing for organizers who upgrade within the specified window.</p>
              <div className="space-y-3">
                {upgrades.map((ug, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-secondary p-4 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-xs capitalize">{ug.from}</Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="outline" className="text-xs capitalize">{ug.to}</Badge>
                    </div>
                    {editingPlans ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">Discount:</Label>
                          <Input type="number" value={ug.discountPrice} onChange={e => {
                            const updated = [...upgrades]; updated[idx] = { ...ug, discountPrice: Number(e.target.value) }; setUpgrades(updated);
                          }} className="h-7 w-20 text-xs border-border bg-card" />
                          <span className="text-xs text-muted-foreground">ETB</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">Full:</Label>
                          <Input type="number" value={ug.fullPrice} onChange={e => {
                            const updated = [...upgrades]; updated[idx] = { ...ug, fullPrice: Number(e.target.value) }; setUpgrades(updated);
                          }} className="h-7 w-20 text-xs border-border bg-card" />
                          <span className="text-xs text-muted-foreground">ETB</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">Window:</Label>
                          <Input type="number" value={ug.discountWindowDays} onChange={e => {
                            const updated = [...upgrades]; updated[idx] = { ...ug, discountWindowDays: Number(e.target.value) }; setUpgrades(updated);
                          }} className="h-7 w-14 text-xs border-border bg-card" />
                          <span className="text-xs text-muted-foreground">days</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Discount: <span className="text-foreground font-semibold">{ug.discountPrice.toLocaleString()} ETB</span></span>
                        <span>Full: <span className="text-foreground font-semibold">{ug.fullPrice.toLocaleString()} ETB</span></span>
                        <span>Within <span className="text-foreground font-semibold">{ug.discountWindowDays}</span> days</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSubscriptions;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Crown, Zap, Building2, CreditCard, Clock, Check, X,
  ArrowUpCircle, Loader2, AlertTriangle, Eye, RefreshCw,
} from "lucide-react";

interface Props {
  userId: string;
  onRequirePlan?: () => void;
}

const PLAN_META: Record<string, { label: string; icon: React.ElementType; color: string; features: string[] }> = {
  free: { label: "Free (Exploring)", icon: CreditCard, color: "text-muted-foreground", features: ["Browse dashboard", "No active features"] },
  organizer: {
    label: "Organizer", icon: Zap, color: "text-blue-500",
    features: ["Up to 100 registrations", "QR code check-in", "Basic analytics", "Registration data export", "Email confirmations (up to 100)", "Basic promotion tools"],
  },
  pro: {
    label: "Pro Organizer", icon: Crown, color: "text-amber-500",
    features: ["Up to 300 registrations", "Checked-in data export", "Advanced analytics", "Multi-device check-in support", "Bulk invite past attendees (up to 50)", "Survey form (QR code only)", "1 check-in staff support", "Advanced promotion tools"],
  },
  corporate: {
    label: "Corporate", icon: Building2, color: "text-purple-500",
    features: ["Unlimited registrations", "Advanced reporting", "Attendee Intelligence (CRM)", "Unlimited past event invites", "Multi-device check-in support", "Registration supporting staff", "Survey (QR + email)", "Advanced promotion tools"],
  },
};

interface PaymentRecord {
  id: string;
  plan: string;
  amount: number;
  status: string;
  transaction_number: string | null;
  receipt_url: string | null;
  admin_notes: string | null;
  created_at: string;
}

const OrganizerSubscription = ({ userId, onRequirePlan }: Props) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: prof }, { data: pays }] = await Promise.all([
      supabase.from("organizer_profiles")
        .select("subscription_plan, subscription_paid, subscription_expires_at, is_suspended")
        .eq("user_id", userId).single(),
      supabase.from("subscription_payments")
        .select("*")
        .eq("organizer_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    setProfile(prof);
    setPayments((pays as PaymentRecord[]) || []);
    setLoading(false);
  };

  const viewReceipt = async (url: string) => {
    const { data } = await supabase.storage.from("subscription-receipts").createSignedUrl(url, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const plan = profile?.subscription_plan || "free";
  const meta = PLAN_META[plan] || PLAN_META.free;
  const isPaid = profile?.subscription_paid;
  const expiresAt = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
  const isExpired = expiresAt ? expiresAt < new Date() : true;
  const isSuspended = profile?.is_suspended;
  const hasPendingPayment = payments.some(p => p.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">My Subscription</h2>
          <p className="text-sm text-muted-foreground">Manage your plan, view payment history, and upgrade.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="border-border">
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Current Plan Card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-primary/10`}>
            <meta.icon className={`h-6 w-6 ${meta.color}`} />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold text-foreground">{meta.label}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {isPaid && !isExpired && !isSuspended && (
                <Badge className="bg-primary/10 text-primary text-xs"><Check className="h-3 w-3 mr-1" /> Active</Badge>
              )}
              {isSuspended && (
                <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Suspended</Badge>
              )}
              {hasPendingPayment && (
                <Badge className="bg-amber-500/10 text-amber-600 text-xs"><Clock className="h-3 w-3 mr-1" /> Payment Pending Review</Badge>
              )}
              {!isPaid && !hasPendingPayment && plan === "free" && (
                <Badge variant="outline" className="text-xs text-muted-foreground">No active subscription</Badge>
              )}
              {isPaid && isExpired && !isSuspended && (
                <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Expired</Badge>
              )}
            </div>
          </div>
        </div>

        {expiresAt && isPaid && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Expires: <span className={`font-medium ${isExpired ? "text-destructive" : "text-foreground"}`}>{expiresAt.toLocaleDateString()}</span>
              {plan === "corporate" && !isExpired && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining)
                </span>
              )}
            </span>
          </div>
        )}

        {/* Plan Features */}
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-foreground mb-2">Plan Features</h4>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {meta.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {(plan === "free" || (!isPaid && !hasPendingPayment)) && (
            <Button onClick={onRequirePlan} className="bg-gradient-gold text-primary-foreground">
              <CreditCard className="h-4 w-4 mr-1" /> Subscribe to a Plan
            </Button>
          )}
          {isPaid && !isExpired && (plan === "organizer" || plan === "pro") && (
            <Button onClick={onRequirePlan} variant="outline" className="border-primary text-primary">
              <ArrowUpCircle className="h-4 w-4 mr-1" /> Upgrade Plan
            </Button>
          )}
        </div>
      </div>

      {/* Pending Payment Alert */}
      {hasPendingPayment && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-foreground">Payment Under Review</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Your latest payment is being reviewed by the admin. This usually takes a few hours. 
              You'll get full access once approved.
            </p>
          </div>
        </div>
      )}

      {/* Suspended Alert */}
      {isSuspended && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-foreground">Account Suspended</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Your account has been suspended. Please contact the platform admin for more information.
            </p>
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-display text-base font-bold text-foreground">Payment History</h3>
        {payments.length === 0 ? (
          <div className="text-center py-6">
            <CreditCard className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No payments yet</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead className="text-xs">Plan</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                  <TableHead className="text-xs">Transaction #</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Receipt</TableHead>
                  <TableHead className="text-xs">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(p => {
                  const pMeta = PLAN_META[p.plan] || PLAN_META.free;
                  const statusColor = p.status === "approved" ? "bg-primary/10 text-primary"
                    : p.status === "rejected" ? "bg-destructive/10 text-destructive"
                    : "bg-amber-500/10 text-amber-600";
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs gap-1">
                          <pMeta.icon className={`h-3 w-3 ${pMeta.color}`} />
                          {pMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-foreground">{p.amount.toLocaleString()} ETB</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{p.transaction_number || "—"}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs capitalize ${statusColor}`}>{p.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {p.receipt_url ? (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-primary" onClick={() => viewReceipt(p.receipt_url!)}>
                            <Eye className="h-3 w-3 mr-1" /> View
                          </Button>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                        {p.admin_notes ? (
                          <span className="truncate block">{p.admin_notes}</span>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizerSubscription;

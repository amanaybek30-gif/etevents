import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CreditCard, Clock, AlertTriangle, Check, Crown, Zap, Building2, Ban, X, ChevronLeft, ChevronRight, Plus, Minus, Wrench, Users, Upload } from "lucide-react";

interface Props {
  userId: string;
  children: React.ReactNode;
}

interface SubSettings {
  enabled: boolean;
  graceDays: number;
  paymentMethods: string[];
  paymentDetails: Record<string, any>;
}

const PLANS = [
  {
    id: "organizer",
    name: "Organizer",
    price: "1,800",
    priceNum: 1800,
    icon: Zap,
    popular: true,
    features: [
      "Up to 100 registrations (imported + platform)",
      "QR code check-in",
      "Attendee management dashboard",
      "Basic analytics",
      "Registration data export",
      "Email confirmations (up to 100)",
      "Basic promotion tools",
    ],
    notIncluded: [
      "Survey forms",
      "Checked-in attendee export",
      "Advanced analytics",
      "Multi-device check-in",
      "Bulk invite past attendees",
      "Attendee Intelligence (CRM)",
    ],
    limits: { registrations: 100 },
  },
  {
    id: "pro",
    name: "Pro Organizer",
    price: "6,500",
    priceNum: 6500,
    icon: Crown,
    features: [
      "All Organizer plan features",
      "Up to 300 registrations",
      "Registration & checked-in data export",
      "Advanced analytics",
      "Multi-device check-in support",
      "Bulk invite past attendees (up to 50)",
      "Survey form (QR code only)",
      "Email confirmations",
      "1 check-in staff support",
      "Advanced promotion tools",
    ],
    notIncluded: [
      "Attendee Intelligence (CRM)",
      "Survey via email",
      "Custom integrations",
    ],
    limits: { registrations: 300 },
  },
  {
    id: "corporate",
    name: "Corporate",
    price: "10,500",
    priceNum: 10500,
    icon: Building2,
    features: [
      "All Pro plan features",
      "Unlimited registrations",
      "Advanced reporting",
      "Attendee Intelligence (CRM)",
      "Unlimited past event invites",
      "Multi-device check-in support",
      "Registration supporting staff",
      "Custom integrations",
      "Survey form (QR + email to checked-in attendees)",
      "Advanced promotion tools",
      "Valid for 2 months from activation",
    ],
    limits: { registrations: -1 },
    duration: "2 months",
  },
];

const ADDONS = [
  { id: "staff_support", name: "Staff Support", price: "2,500", priceNum: 2500 },
  { id: "custom_request", name: "Custom Request", price: null, priceNum: 0 },
];

const SubscriptionGate = ({ userId, children }: Props) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subSettings, setSubSettings] = useState<SubSettings | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [status, setStatus] = useState<"active" | "grace" | "expired" | "not_required" | "choose_plan" | "suspended">("not_required");
  const [graceDaysLeft, setGraceDaysLeft] = useState(0);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [showCustomRequest, setShowCustomRequest] = useState(false);
  const [customRequestStep, setCustomRequestStep] = useState(0);
  const [transactionNumber, setTransactionNumber] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [customRequestData, setCustomRequestData] = useState<Record<string, any>>({
    eventName: "", eventDate: "", eventLocation: "", expectedAttendees: "",
    onsiteServices: [] as string[], technicalServices: [] as string[],
    marketingServices: [] as string[], dataServices: [] as string[],
    otherDescription: "",
    staffCount: "", eventDuration: "", budgetRange: "",
    contactName: "", contactEmail: "", contactPhone: "", contactOrg: "",
    urgency: "",
  });

  useEffect(() => { checkSubscription(); }, [userId]);

  const checkSubscription = async () => {
    const { data: settingsData } = await supabase.from("platform_settings").select("key, value");
    if (!settingsData) { setLoading(false); setStatus("not_required"); return; }

    const map: Record<string, string> = {};
    settingsData.forEach(s => { map[s.key] = s.value; });

    if (map["subscription_enabled"] !== "true") {
      setStatus("not_required"); setLoading(false); return;
    }

    const parseJSON = (str: string | undefined, fb: any) => { try { return str ? JSON.parse(str) : fb; } catch { return fb; } };

    const settings: SubSettings = {
      enabled: true,
      graceDays: parseInt(map["subscription_grace_days"] || "7"),
      paymentMethods: parseJSON(map["subscription_payment_methods"], []),
      paymentDetails: parseJSON(map["subscription_payment_details"], {}),
    };
    setSubSettings(settings);

    const { data: prof } = await supabase.from("organizer_profiles").select("*").eq("user_id", userId).single();
    setProfile(prof);

    if (!prof) { setStatus("not_required"); setLoading(false); return; }
    if (prof.is_suspended) { setStatus("suspended"); setLoading(false); return; }

    if (prof.subscription_paid && prof.subscription_expires_at) {
      const expiresAt = new Date(prof.subscription_expires_at);
      if (expiresAt > new Date()) { setStatus("active"); setLoading(false); return; }
    }

    if (!prof.subscription_paid && (!prof.subscription_plan || prof.subscription_plan === "free")) {
      setStatus("choose_plan"); setLoading(false); return;
    }

    if (!prof.subscription_paid && prof.subscription_plan !== "free") {
      if (prof.subscription_expires_at) {
        const graceEnd = new Date(prof.subscription_expires_at);
        if (new Date() < graceEnd) {
          const daysLeft = Math.ceil((graceEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          setGraceDaysLeft(daysLeft);
          setStatus("grace");
          setLoading(false);
          return;
        }
      }
    }

    setStatus("expired");
    setLoading(false);
  };

  const toggleAddon = (addonId: string) => {
    if (addonId === "custom_request") {
      setShowCustomRequest(true);
      setCustomRequestStep(0);
      return;
    }
    setSelectedAddons(prev => {
      const current = prev[addonId] || 0;
      return { ...prev, [addonId]: current > 0 ? 0 : 1 };
    });
  };

  const getAddonTotal = () => {
    return Object.entries(selectedAddons).reduce((sum, [id, qty]) => {
      const addon = ADDONS.find(a => a.id === id);
      return sum + (addon?.priceNum || 0) * qty;
    }, 0);
  };

  const selectPlan = async (planId: string) => {
    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return;
    const addonTotal = getAddonTotal();
    const totalCost = plan.priceNum + addonTotal;

    await supabase.from("organizer_profiles").update({
      subscription_plan: planId,
      subscription_expires_at: new Date(Date.now() + (subSettings?.graceDays || 7) * 24 * 60 * 60 * 1000).toISOString(),
    }).eq("user_id", userId);
    setShowPayment(true);
  };

  const submitCustomRequest = async () => {
    const d = customRequestData;
    if (!d.contactName || !d.contactEmail || !d.contactPhone) {
      return;
    }
    // Store as admin notification
    const details = JSON.stringify(customRequestData);
    await supabase.from("admin_notifications").insert({
      title: "Custom Request from Organizer",
      message: `${d.contactName} (${d.contactOrg || "N/A"}) requested custom services for "${d.eventName}". Budget: ${d.budgetRange || "Not specified"}. Urgency: ${d.urgency || "Flexible"}.`,
      type: "request",
      target: "admin",
    });
    setShowCustomRequest(false);
    setCustomRequestStep(0);
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (status === "not_required" || status === "active" || status === "choose_plan" || status === "expired") return <>{children}</>;

  if (status === "suspended") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 sm:p-8 space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <Ban className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Account Suspended</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Your account has been suspended by the administrator. Please contact support for more information.
            </p>
          </div>
          <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate("/"); }} className="w-full border-border text-muted-foreground">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  if (status === "grace") {
    return (
      <>
        <div className="sticky top-0 z-40 bg-destructive/10 border-b border-destructive/20 px-4 py-2">
          <div className="flex items-center justify-center gap-2 text-sm text-destructive flex-wrap">
            <Clock className="h-4 w-4" />
            <span>
              Payment pending — <strong>{graceDaysLeft} day{graceDaysLeft !== 1 ? "s" : ""}</strong> left.
              Complete payment and wait for admin approval.
            </span>
            <Button size="sm" variant="outline" className="border-destructive text-destructive h-7 text-xs ml-2" onClick={() => setShowPayment(true)}>
              View Payment Details
            </Button>
          </div>
        </div>
        {children}

        {showPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setShowPayment(false)}>
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="font-display text-lg font-bold text-foreground text-center">Complete Payment</h3>
              <div className="rounded-lg border border-border bg-secondary p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{PLANS.find(p => p.id === profile?.subscription_plan)?.price || "—"} ETB</p>
                <p className="text-xs text-muted-foreground capitalize">{profile?.subscription_plan} Plan (per event)</p>
              </div>
              {renderPaymentMethods()}
              {renderPaymentConfirmation(PLANS.find(p => p.id === profile?.subscription_plan)?.priceNum || 0)}
              <Button variant="outline" onClick={() => setShowPayment(false)} className="w-full border-border">Close</Button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Choose plan page
  if (status === "choose_plan") {
    const selectedPlan = PLANS.find(p => p.id === profile?.subscription_plan);
    const addonTotal = getAddonTotal();

    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h1 className="font-display text-3xl font-bold text-foreground">Choose Your Plan</h1>
            <p className="text-muted-foreground">Select the plan that fits your event management needs. All plans are per event.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {PLANS.map(plan => (
              <div key={plan.id} className={`relative rounded-xl border p-5 space-y-4 transition-all ${plan.popular ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border bg-card"}`}>
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                    Popular
                  </span>
                )}
                <div className="text-center space-y-2">
                  <plan.icon className={`mx-auto h-8 w-8 ${plan.popular ? "text-primary" : "text-muted-foreground"}`} />
                  <h3 className="font-display text-lg font-bold text-foreground">{plan.name}</h3>
                  <div>
                    <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-xs text-muted-foreground"> ETB / event</span>
                  </div>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.notIncluded && (
                  <ul className="space-y-1 pt-2 border-t border-border">
                    {plan.notIncluded.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground/50">
                        <X className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
                <Button onClick={() => selectPlan(plan.id)} className={`w-full ${plan.popular ? "bg-gradient-gold text-primary-foreground" : ""}`}
                  variant={plan.popular ? "default" : "outline"}>
                  Select Plan
                </Button>
              </div>
            ))}
          </div>

          {/* Add-ons */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-foreground text-center">Add-Ons</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {ADDONS.map(addon => {
                const qty = selectedAddons[addon.id] || 0;
                const isCustom = addon.id === "custom_request";
                return (
                  <div key={addon.id} className={`rounded-lg border p-4 space-y-2 transition-all ${qty > 0 ? "border-primary bg-primary/5" : "border-border bg-secondary"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{addon.name}</p>
                        {addon.price ? (
                          <p className="text-lg font-bold text-primary">{addon.price} ETB</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Contact for pricing</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={qty > 0 && !isCustom ? "default" : "outline"}
                        onClick={() => toggleAddon(addon.id)}
                        className={`h-9 ${qty > 0 && !isCustom ? "bg-gradient-gold text-primary-foreground" : "border-border hover:border-primary"}`}
                      >
                        {isCustom ? (
                          <><Wrench className="h-3.5 w-3.5 mr-1" /> Request</>
                        ) : qty > 0 ? (
                          <><Check className="h-3.5 w-3.5 mr-1" /> Added</>
                        ) : (
                          <><Plus className="h-3.5 w-3.5 mr-1" /> Add</>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {addonTotal > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
                <p className="text-sm text-muted-foreground">Add-on total: <span className="font-bold text-foreground">{addonTotal.toLocaleString()} ETB</span></p>
              </div>
            )}
          </div>

          {/* Total Cost Summary */}
          {addonTotal > 0 && (
            <div className="rounded-xl border border-primary bg-primary/5 p-4 text-center space-y-1">
              <p className="text-xs text-muted-foreground">Select a plan above to see your total</p>
              <p className="text-sm text-muted-foreground">
                Plan + Add-ons = <span className="font-bold text-foreground">Plan Price + {addonTotal.toLocaleString()} ETB</span>
              </p>
            </div>
          )}
        </div>

        {showPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setShowPayment(false)}>
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="font-display text-lg font-bold text-foreground text-center">Complete Payment</h3>
              <p className="text-sm text-muted-foreground text-center">After payment, the admin will review and activate your account.</p>
              <div className="rounded-lg border border-border bg-secondary p-4 space-y-2">
                {(() => {
                  const plan = PLANS.find(p => p.id === profile?.subscription_plan);
                  const planPrice = plan?.priceNum || 0;
                  const total = planPrice + addonTotal;
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{plan?.name} Plan</span>
                        <span className="text-foreground font-semibold">{planPrice.toLocaleString()} ETB</span>
                      </div>
                      {Object.entries(selectedAddons).filter(([, q]) => q > 0).map(([id, qty]) => {
                        const addon = ADDONS.find(a => a.id === id);
                        if (!addon || !addon.priceNum) return null;
                        return (
                          <div key={id} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{addon.name} ×{qty}</span>
                            <span className="text-foreground">{(addon.priceNum * qty).toLocaleString()} ETB</span>
                          </div>
                        );
                      })}
                      <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
                        <span className="text-foreground">Total</span>
                        <span className="text-primary">{total.toLocaleString()} ETB</span>
                      </div>
                    </>
                  );
                })()}
              </div>
              {renderPaymentMethods()}
              {renderPaymentConfirmation((() => {
                const plan = PLANS.find(p => p.id === profile?.subscription_plan);
                return (plan?.priceNum || 0) + addonTotal;
              })())}
            </div>
          </div>
        )}

        {/* Custom Request Multi-Step Dialog */}
        {showCustomRequest && renderCustomRequestDialog()}
      </div>
    );
  }

  // Expired
  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/"); };

  function renderPaymentMethods() {
    if (!subSettings || subSettings.paymentMethods.length === 0) return null;
    return (
      <div className="space-y-3 text-left">
        <h4 className="text-sm font-semibold text-foreground">Payment Methods</h4>
        {subSettings.paymentMethods.includes("bank_transfer") && subSettings.paymentDetails.bankName && (
          <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-1">
            <p className="text-xs font-semibold text-primary">Bank Transfer</p>
            <p className="text-xs text-muted-foreground">Bank: <span className="text-foreground">{subSettings.paymentDetails.bankName}</span></p>
            <p className="text-xs text-muted-foreground">Account: <span className="text-foreground font-mono">{subSettings.paymentDetails.bankAccount}</span></p>
            {subSettings.paymentDetails.bankHolder && <p className="text-xs text-muted-foreground">Name: <span className="text-foreground">{subSettings.paymentDetails.bankHolder}</span></p>}
          </div>
        )}
        {subSettings.paymentMethods.includes("telebirr") && subSettings.paymentDetails.telebirrPhone && (
          <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-1">
            <p className="text-xs font-semibold text-primary">Telebirr</p>
            <p className="text-xs text-muted-foreground">Name: <span className="text-foreground">{subSettings.paymentDetails.telebirrName}</span></p>
            <p className="text-xs text-muted-foreground">Phone: <span className="text-foreground font-mono">{subSettings.paymentDetails.telebirrPhone}</span></p>
          </div>
        )}
        {subSettings.paymentMethods.includes("mpessa") && subSettings.paymentDetails.mpessaPhone && (
          <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-1">
            <p className="text-xs font-semibold text-primary">Mpessa</p>
            <p className="text-xs text-muted-foreground">Name: <span className="text-foreground">{subSettings.paymentDetails.mpessaName}</span></p>
            <p className="text-xs text-muted-foreground">Phone: <span className="text-foreground font-mono">{subSettings.paymentDetails.mpessaPhone}</span></p>
          </div>
        )}
        {subSettings.paymentDetails?.instructions && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs font-semibold text-primary mb-1">Instructions</p>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{subSettings.paymentDetails.instructions}</p>
          </div>
        )}
      </div>
    );
  }

  function renderPaymentConfirmation(amount: number) {
    const handleSubmitPayment = async () => {
      if (!transactionNumber && !receiptFile) {
        toast.error("Please enter a transaction number or upload a receipt");
        return;
      }
      setSubmittingPayment(true);
      try {
        let receiptPath: string | null = null;
        if (receiptFile) {
          const ext = receiptFile.name.split(".").pop();
          const path = `${userId}/${Date.now()}.${ext}`;
          const { error: uploadErr } = await supabase.storage.from("subscription-receipts").upload(path, receiptFile);
          if (uploadErr) { toast.error("Failed to upload receipt"); setSubmittingPayment(false); return; }
          receiptPath = path;
        }

        const addonsList = Object.entries(selectedAddons).filter(([, q]) => q > 0).map(([id, qty]) => {
          const addon = ADDONS.find(a => a.id === id);
          return { id, name: addon?.name, qty, price: (addon?.priceNum || 0) * qty };
        });

        await supabase.from("subscription_payments").insert({
          organizer_id: userId,
          plan: profile?.subscription_plan || "organizer",
          amount,
          addons: addonsList,
          transaction_number: transactionNumber || null,
          receipt_url: receiptPath,
          status: "pending",
        });

        toast.success("Payment submitted! Admin will review and activate your account.");
        setShowPayment(false);
        setTransactionNumber("");
        setReceiptFile(null);
        setStatus("grace");
        setGraceDaysLeft(subSettings?.graceDays || 7);
        checkSubscription();
      } catch (err) {
        toast.error("Something went wrong");
      }
      setSubmittingPayment(false);
    };

    return (
      <div className="space-y-3 border-t border-border pt-3">
        <h4 className="text-sm font-semibold text-foreground">Confirm Your Payment</h4>
        <div className="space-y-1">
          <Label className="text-xs">Transaction Number</Label>
          <Input
            value={transactionNumber}
            onChange={e => setTransactionNumber(e.target.value)}
            placeholder="Enter your transaction/reference number"
            className="border-border bg-secondary text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Upload Receipt (optional)</Label>
          <div className="flex items-center gap-2">
            <label className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary p-3 cursor-pointer hover:border-primary transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{receiptFile ? receiptFile.name : "Click to upload receipt"}</span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => setReceiptFile(e.target.files?.[0] || null)}
              />
            </label>
            {receiptFile && (
              <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive" onClick={() => setReceiptFile(null)}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3" />
          <span>After submitting, the admin will review and activate your account.</span>
        </div>
        <Button
          onClick={handleSubmitPayment}
          disabled={submittingPayment || (!transactionNumber && !receiptFile)}
          className="w-full bg-gradient-gold text-primary-foreground"
        >
          {submittingPayment ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CreditCard className="h-4 w-4 mr-1" />}
          I've Made the Payment
        </Button>
      </div>
    );
  }

  function renderCustomRequestDialog() {
    const steps = [
      "Event Information",
      "Services Needed",
      "Staff & Duration",
      "Budget & Contact",
    ];

    const updateCR = (key: string, val: any) => setCustomRequestData(prev => ({ ...prev, [key]: val }));
    const toggleArray = (key: string, val: string) => {
      setCustomRequestData(prev => {
        const arr = prev[key] as string[];
        return { ...prev, [key]: arr.includes(val) ? arr.filter((v: string) => v !== val) : [...arr, val] };
      });
    };

    const d = customRequestData;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setShowCustomRequest(false)}>
        <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-foreground">Custom Request</h3>
            <button onClick={() => setShowCustomRequest(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>

          <p className="text-sm text-muted-foreground italic">
            "Need something more advanced? Our team can support your event with custom solutions."
          </p>

          {/* Step indicator */}
          <div className="flex gap-1">
            {steps.map((s, i) => (
              <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= customRequestStep ? "bg-primary" : "bg-border"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center">{steps[customRequestStep]} ({customRequestStep + 1}/{steps.length})</p>

          {/* Step 0: Event Information */}
          {customRequestStep === 0 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Event Name</Label>
                <Input value={d.eventName} onChange={e => updateCR("eventName", e.target.value)} placeholder="Your event name" className="border-border bg-secondary" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Event Date</Label>
                <Input type="date" value={d.eventDate} onChange={e => updateCR("eventDate", e.target.value)} className="border-border bg-secondary" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Event Location (City & Venue)</Label>
                <Input value={d.eventLocation} onChange={e => updateCR("eventLocation", e.target.value)} placeholder="Addis Ababa, Skylight Hotel" className="border-border bg-secondary" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Expected Number of Attendees</Label>
                <Input type="number" value={d.expectedAttendees} onChange={e => updateCR("expectedAttendees", e.target.value)} placeholder="500" className="border-border bg-secondary" />
              </div>
            </div>
          )}

          {/* Step 1: Services Needed */}
          {customRequestStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">On-site Services</Label>
                {["QR Check-in staff", "Badge printing", "Registration desk management"].map(s => (
                  <label key={s} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox checked={d.onsiteServices.includes(s)} onCheckedChange={() => toggleArray("onsiteServices", s)} />
                    {s}
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Technical Services</Label>
                {["Custom registration form", "Custom event page design", "API integration", "Website integration"].map(s => (
                  <label key={s} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox checked={d.technicalServices.includes(s)} onCheckedChange={() => toggleArray("technicalServices", s)} />
                    {s}
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Marketing & Communication</Label>
                {["Email invitation campaigns", "SMS reminders", "Event promotion support"].map(s => (
                  <label key={s} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox checked={d.marketingServices.includes(s)} onCheckedChange={() => toggleArray("marketingServices", s)} />
                    {s}
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Data & Analytics</Label>
                {["Advanced event analytics report", "Attendee segmentation", "Post-event insights"].map(s => (
                  <label key={s} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox checked={d.dataServices.includes(s)} onCheckedChange={() => toggleArray("dataServices", s)} />
                    {s}
                  </label>
                ))}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Other</Label>
                <Textarea value={d.otherDescription} onChange={e => updateCR("otherDescription", e.target.value)} placeholder="Describe your request..." className="border-border bg-secondary min-h-[60px]" />
              </div>
            </div>
          )}

          {/* Step 2: Staff & Duration */}
          {customRequestStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Number of Staff Required</Label>
                {["1–2 staff", "3–5 staff", "6+ staff"].map(s => (
                  <label key={s} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input type="radio" name="staffCount" checked={d.staffCount === s} onChange={() => updateCR("staffCount", s)} className="accent-primary" />
                    {s}
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Event Duration</Label>
                {["Half-day", "Full day", "Multiple days"].map(s => (
                  <label key={s} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input type="radio" name="eventDuration" checked={d.eventDuration === s} onChange={() => updateCR("eventDuration", s)} className="accent-primary" />
                    {s}
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Budget Range (Optional)</Label>
                {["Under 5,000 ETB", "5,000 – 10,000 ETB", "10,000 – 25,000 ETB", "25,000+ ETB"].map(s => (
                  <label key={s} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input type="radio" name="budgetRange" checked={d.budgetRange === s} onChange={() => updateCR("budgetRange", s)} className="accent-primary" />
                    {s}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Contact & Urgency */}
          {customRequestStep === 3 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input value={d.contactName} onChange={e => updateCR("contactName", e.target.value)} placeholder="Your name" className="border-border bg-secondary" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email *</Label>
                <Input type="email" value={d.contactEmail} onChange={e => updateCR("contactEmail", e.target.value)} placeholder="email@example.com" className="border-border bg-secondary" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone *</Label>
                <Input value={d.contactPhone} onChange={e => updateCR("contactPhone", e.target.value)} placeholder="+251..." className="border-border bg-secondary" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Organization (Optional)</Label>
                <Input value={d.contactOrg} onChange={e => updateCR("contactOrg", e.target.value)} placeholder="Your organization" className="border-border bg-secondary" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Deadline / Urgency</Label>
                {["Within 3 days", "Within 1 week", "Within 2 weeks", "Flexible"].map(s => (
                  <label key={s} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input type="radio" name="urgency" checked={d.urgency === s} onChange={() => updateCR("urgency", s)} className="accent-primary" />
                    {s}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-2 pt-2">
            {customRequestStep > 0 && (
              <Button variant="outline" onClick={() => setCustomRequestStep(s => s - 1)} className="flex-1 border-border">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {customRequestStep < 3 ? (
              <Button onClick={() => setCustomRequestStep(s => s + 1)} className="flex-1 bg-gradient-gold text-primary-foreground">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={submitCustomRequest} className="flex-1 bg-gradient-gold text-primary-foreground">
                Submit Request
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 sm:p-8 space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <CreditCard className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Subscription Expired</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Your subscription has expired. Please renew to continue using the platform.
          </p>
        </div>
        <Button onClick={() => setStatus("choose_plan")} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90">
          <CreditCard className="mr-2 h-4 w-4" /> View Plans & Pay
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3" />
          <span>After payment, the admin will activate your account.</span>
        </div>
        <Button variant="outline" onClick={handleSignOut} className="w-full border-border text-muted-foreground hover:text-foreground">
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default SubscriptionGate;

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Check, X, Crown, Zap, Building2, Plus, Wrench,
  CreditCard, Upload, AlertTriangle, Loader2, CheckCircle2, Clock, ArrowUpCircle,
} from "lucide-react";
import CustomRequestWizard from "./CustomRequestWizard";

const PLANS = [
  {
    id: "organizer", name: "Organizer", price: "1,800", priceNum: 1800, icon: Zap, popular: true,
    features: ["Up to 100 registrations", "QR code check-in", "Basic analytics", "Registration data export", "Email confirmations (up to 100)", "Basic promotion tools"],
    notIncluded: ["Survey forms", "Checked-in attendee export", "Advanced analytics", "Multi-device check-in", "Bulk invite past attendees", "Attendee Intelligence (CRM)"],
  },
  {
    id: "pro", name: "Pro Organizer", price: "6,500", priceNum: 6500, icon: Crown,
    features: ["All Organizer features", "Up to 300 registrations", "Checked-in data export", "Advanced analytics", "Multi-device check-in support", "Bulk invite past attendees (up to 50)", "Survey form (QR code only)", "1 check-in staff support", "Advanced promotion tools"],
    notIncluded: ["Attendee Intelligence (CRM)", "Survey via email", "Custom integrations"],
  },
  {
    id: "corporate", name: "Corporate", price: "10,500", priceNum: 10500, icon: Building2,
    features: ["All Pro features", "Unlimited registrations", "Advanced reporting", "Attendee Intelligence (CRM)", "Unlimited past event invites", "Multi-device check-in support", "Registration supporting staff", "Survey (QR + email)", "Advanced promotion tools"],
  },
];

const ADDONS = [
  { id: "staff_support", name: "Staff Support", desc: "Get dedicated check-in staff for your event", price: "2,500", priceNum: 2500 },
];

const PLAN_ORDER = ["free", "organizer", "pro", "corporate"];

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
}

const PlanPromptDialog = ({ open, onClose, userId }: Props) => {
  const [showCustomRequest, setShowCustomRequest] = useState(false);
  const [step, setStep] = useState<"plan" | "payment" | "upgrade" | "done">("plan");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});
  const [transactionNumber, setTransactionNumber] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [paymentDetails, setPaymentDetails] = useState<Record<string, any>>({});

  // Upgrade state
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [upgradeToPlan, setUpgradeToPlan] = useState<string | null>(null);
  const [upgradeReason, setUpgradeReason] = useState("");
  const [upgradePrice, setUpgradePrice] = useState(0);
  const [isEarlyUpgrade, setIsEarlyUpgrade] = useState(false);
  const [subscriptionPaidAt, setSubscriptionPaidAt] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const fetchProfile = async () => {
      const { data: prof } = await supabase.from("organizer_profiles")
        .select("subscription_plan")
        .eq("user_id", userId).single();
      if (prof) setCurrentPlan(prof.subscription_plan || "free");

      // Get latest approved payment date
      const { data: lastPayment } = await supabase.from("subscription_payments")
        .select("created_at")
        .eq("organizer_id", userId)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(1);
      if (lastPayment?.[0]) setSubscriptionPaidAt(lastPayment[0].created_at);
      else setSubscriptionPaidAt(null);
    };
    fetchProfile();
  }, [open, userId]);

  if (!open) return null;

  const currentPlanIndex = PLAN_ORDER.indexOf(currentPlan);
  const canUpgrade = currentPlan === "organizer" || currentPlan === "pro";

  const selectedPlan = PLANS.find(p => p.id === selectedPlanId);
  const addonTotal = Object.entries(selectedAddons)
    .filter(([, v]) => v)
    .reduce((sum, [id]) => sum + (ADDONS.find(a => a.id === id)?.priceNum || 0), 0);
  const totalAmount = step === "upgrade" ? upgradePrice + addonTotal : (selectedPlan?.priceNum || 0) + addonTotal;

  const calculateUpgradePrice = (fromPlan: string, toPlan: string): { price: number; early: boolean } => {
    const daysSincePaid = subscriptionPaidAt
      ? Math.floor((Date.now() - new Date(subscriptionPaidAt).getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    const isWithin7Days = daysSincePaid <= 7;

    if (fromPlan === "organizer" && toPlan === "pro") {
      return { price: isWithin7Days ? 5000 : 6500, early: isWithin7Days };
    }
    if (fromPlan === "pro" && toPlan === "corporate") {
      return { price: isWithin7Days ? 4500 : 10500, early: isWithin7Days };
    }
    if (fromPlan === "organizer" && toPlan === "corporate") {
      return { price: 10500, early: false };
    }
    return { price: 0, early: false };
  };

  const handleSelectPlan = async (planId: string) => {
    setSelectedPlanId(planId);
    const { data: settingsData } = await supabase.from("platform_settings").select("key, value");
    if (settingsData) {
      const map: Record<string, string> = {};
      settingsData.forEach(s => { map[s.key] = s.value; });
      try { setPaymentMethods(JSON.parse(map["subscription_payment_methods"] || "[]")); } catch { setPaymentMethods([]); }
      try { setPaymentDetails(JSON.parse(map["subscription_payment_details"] || "{}")); } catch { setPaymentDetails({}); }
    }
    const graceDaysStr = settingsData?.find(s => s.key === "subscription_grace_days")?.value;
    const graceDays = parseInt(graceDaysStr || "7");
    await supabase.from("organizer_profiles").update({
      subscription_plan: planId,
      subscription_expires_at: new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000).toISOString(),
    }).eq("user_id", userId);
    setStep("payment");
  };

  const handleStartUpgrade = async (toPlan: string) => {
    setUpgradeToPlan(toPlan);
    const { price, early } = calculateUpgradePrice(currentPlan, toPlan);
    setUpgradePrice(price);
    setIsEarlyUpgrade(early);

    const { data: settingsData } = await supabase.from("platform_settings").select("key, value");
    if (settingsData) {
      const map: Record<string, string> = {};
      settingsData.forEach(s => { map[s.key] = s.value; });
      try { setPaymentMethods(JSON.parse(map["subscription_payment_methods"] || "[]")); } catch { setPaymentMethods([]); }
      try { setPaymentDetails(JSON.parse(map["subscription_payment_details"] || "{}")); } catch { setPaymentDetails({}); }
    }
    setStep("upgrade");
  };

  const handleSubmitPayment = async () => {
    if (!transactionNumber && !receiptFile) {
      toast.error("Please enter a transaction number or upload a receipt.");
      return;
    }
    setSubmitting(true);
    try {
      let receiptPath: string | null = null;
      if (receiptFile) {
        const ext = receiptFile.name.split(".").pop();
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("subscription-receipts").upload(path, receiptFile);
        if (uploadErr) { toast.error("Failed to upload receipt."); setSubmitting(false); return; }
        receiptPath = path;
      }

      const addonsList = Object.entries(selectedAddons).filter(([, v]) => v).map(([id]) => {
        const addon = ADDONS.find(a => a.id === id);
        return { id, name: addon?.name, qty: 1, price: addon?.priceNum || 0 };
      });

      const isUpgrade = step === "upgrade";
      const planToSubmit = isUpgrade ? upgradeToPlan : selectedPlanId;

      await supabase.from("subscription_payments").insert({
        organizer_id: userId,
        plan: planToSubmit || "organizer",
        amount: totalAmount,
        addons: addonsList,
        transaction_number: transactionNumber || null,
        receipt_url: receiptPath,
        status: "pending",
        admin_notes: isUpgrade ? `UPGRADE from ${currentPlan} to ${planToSubmit}${isEarlyUpgrade ? " (early upgrade discount)" : ""}. Reason: ${upgradeReason}` : null,
      });

      setStep("done");
    } catch {
      toast.error("Something went wrong.");
    }
    setSubmitting(false);
  };

  const handleClose = () => {
    if (step === "done") window.location.reload();
    setStep("plan");
    setSelectedPlanId(null);
    setSelectedAddons({});
    setTransactionNumber("");
    setReceiptFile(null);
    setUpgradeReason("");
    setUpgradeToPlan(null);
    onClose();
  };

  const getUpgradeTargets = () => {
    if (currentPlan === "organizer") return PLANS.filter(p => p.id === "pro" || p.id === "corporate");
    if (currentPlan === "pro") return PLANS.filter(p => p.id === "corporate");
    return [];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={handleClose}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 space-y-6" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">
              {step === "plan" && "Choose a Plan to Get Started"}
              {step === "payment" && "Complete Your Payment"}
              {step === "upgrade" && `Upgrade to ${PLANS.find(p => p.id === upgradeToPlan)?.name}`}
              {step === "done" && "Payment Submitted!"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {step === "plan" && "Select a plan to unlock features and start managing your events."}
              {step === "payment" && "Use the payment details below and confirm your payment."}
              {step === "upgrade" && "Complete the upgrade to access more features."}
              {step === "done" && "Your payment is being reviewed. We'll activate your account shortly."}
            </p>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {/* STEP 1: Plan Selection + Upgrade + Add-ons */}
        {step === "plan" && (
          <>
            {/* Upgrade banner for existing subscribers */}
            {canUpgrade && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-sm font-bold text-foreground">
                    Upgrade Your Plan
                  </h3>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Current: {PLANS.find(p => p.id === currentPlan)?.name || currentPlan}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {getUpgradeTargets().map(target => {
                    const { price, early } = calculateUpgradePrice(currentPlan, target.id);
                    return (
                      <div key={target.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <target.icon className="h-5 w-5 text-primary" />
                          <span className="font-semibold text-foreground text-sm">{target.name}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold text-foreground">{price.toLocaleString()} ETB</span>
                          {early && (
                            <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                              Early upgrade discount
                            </span>
                          )}
                        </div>
                        {early && (
                          <p className="text-xs text-muted-foreground">
                            Discounted price available within 7 days of your subscription.
                          </p>
                        )}
                        <Button size="sm" onClick={() => handleStartUpgrade(target.id)} className="w-full bg-gradient-gold text-primary-foreground">
                          <ArrowUpCircle className="h-3.5 w-3.5 mr-1" /> Upgrade
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              {PLANS.map(plan => {
                const isCurrentPlan = plan.id === currentPlan;
                const isLowerPlan = PLAN_ORDER.indexOf(plan.id) <= currentPlanIndex;
                return (
                  <div key={plan.id} className={`relative rounded-xl border p-5 space-y-4 transition-all ${plan.popular && !isCurrentPlan ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : isCurrentPlan ? "border-primary/50 bg-primary/10" : "border-border bg-secondary"}`}>
                    {isCurrentPlan && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">Current Plan</span>
                    )}
                    {plan.popular && !isCurrentPlan && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">Popular</span>
                    )}
                    <div className="text-center space-y-2">
                      <plan.icon className={`mx-auto h-8 w-8 ${plan.popular || isCurrentPlan ? "text-primary" : "text-muted-foreground"}`} />
                      <h3 className="font-display text-lg font-bold text-foreground">{plan.name}</h3>
                      <div>
                        <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                        <span className="text-xs text-muted-foreground"> ETB / event</span>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> {f}
                        </li>
                      ))}
                    </ul>
                    {plan.notIncluded && (
                      <ul className="space-y-1 pt-2 border-t border-border">
                        {plan.notIncluded.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground/50">
                            <X className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 mt-0.5" /> {f}
                          </li>
                        ))}
                      </ul>
                    )}
                    <Button
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={isLowerPlan && currentPlan !== "free"}
                      className={`w-full ${plan.popular && !isCurrentPlan ? "bg-gradient-gold text-primary-foreground" : ""}`}
                      variant={plan.popular && !isCurrentPlan ? "default" : "outline"}
                    >
                      {isCurrentPlan ? "Current Plan" : isLowerPlan && currentPlan !== "free" ? "Current or Lower" : "Select Plan"}
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Add-ons */}
            <div className="rounded-xl border border-border bg-secondary/50 p-5 space-y-3">
              <h3 className="font-display text-sm font-bold text-foreground">Add-Ons (Optional)</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {ADDONS.map(addon => (
                  <div key={addon.id} className={`rounded-lg border p-4 flex items-center justify-between transition-all ${selectedAddons[addon.id] ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{addon.name}</p>
                      <p className="text-xs text-muted-foreground">{addon.desc}</p>
                      <p className="text-sm font-bold text-primary mt-1">{addon.price} ETB</p>
                    </div>
                    <Button
                      size="sm"
                      variant={selectedAddons[addon.id] ? "default" : "outline"}
                      onClick={() => setSelectedAddons(prev => ({ ...prev, [addon.id]: !prev[addon.id] }))}
                      className={selectedAddons[addon.id] ? "bg-gradient-gold text-primary-foreground" : "border-border"}
                    >
                      {selectedAddons[addon.id] ? <><Check className="h-3.5 w-3.5 mr-1" /> Added</> : <><Plus className="h-3.5 w-3.5 mr-1" /> Add</>}
                    </Button>
                  </div>
                ))}
                {/* Custom Request */}
                <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 flex items-center justify-between transition-all">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Custom Request</p>
                    <p className="text-xs text-muted-foreground">Need advanced support? Get a custom quote.</p>
                    <p className="text-xs text-primary mt-1 font-medium">Custom pricing</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setShowCustomRequest(true)} className="border-primary text-primary">
                    <Wrench className="h-3.5 w-3.5 mr-1" /> Request
                  </Button>
                </div>
              </div>
            </div>

            <CustomRequestWizard open={showCustomRequest} onClose={() => setShowCustomRequest(false)} userId={userId} />
          </>
        )}

        {/* STEP: Upgrade - reason + payment */}
        {step === "upgrade" && upgradeToPlan && (
          <div className="max-w-md mx-auto space-y-5">
            {/* Upgrade summary */}
            <div className="rounded-lg border border-border bg-secondary p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Upgrading from</span>
                <span className="text-foreground font-semibold">{PLANS.find(p => p.id === currentPlan)?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Upgrading to</span>
                <span className="text-foreground font-semibold">{PLANS.find(p => p.id === upgradeToPlan)?.name}</span>
              </div>
              {isEarlyUpgrade && (
                <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-lg">
                  <Check className="h-3.5 w-3.5" />
                  <span>Early upgrade discount applied (within 7 days)</span>
                </div>
              )}
              {Object.entries(selectedAddons).filter(([, v]) => v).map(([id]) => {
                const addon = ADDONS.find(a => a.id === id);
                if (!addon) return null;
                return (
                  <div key={id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{addon.name}</span>
                    <span className="text-foreground">{addon.price} ETB</span>
                  </div>
                );
              })}
              <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
                <span className="text-foreground">Total</span>
                <span className="text-primary">{totalAmount.toLocaleString()} ETB</span>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Why do you want to upgrade? *</Label>
              <Textarea
                value={upgradeReason}
                onChange={e => setUpgradeReason(e.target.value)}
                placeholder="e.g. I need more registrations, I want survey features..."
                className="border-border bg-secondary text-sm min-h-[80px]"
              />
            </div>

            {/* Payment methods */}
            {paymentMethods.length > 0 && (
              <div className="space-y-3 text-left">
                <h4 className="text-sm font-semibold text-foreground">Payment Methods</h4>
                {paymentMethods.includes("bank_transfer") && paymentDetails.bankName && (
                  <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-1">
                    <p className="text-xs font-semibold text-primary">Bank Transfer</p>
                    <p className="text-xs text-muted-foreground">Bank: <span className="text-foreground">{paymentDetails.bankName}</span></p>
                    <p className="text-xs text-muted-foreground">Account: <span className="text-foreground font-mono">{paymentDetails.bankAccount}</span></p>
                    {paymentDetails.bankHolder && <p className="text-xs text-muted-foreground">Name: <span className="text-foreground">{paymentDetails.bankHolder}</span></p>}
                  </div>
                )}
                {paymentMethods.includes("telebirr") && paymentDetails.telebirrPhone && (
                  <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-1">
                    <p className="text-xs font-semibold text-primary">Telebirr</p>
                    <p className="text-xs text-muted-foreground">Name: <span className="text-foreground">{paymentDetails.telebirrName}</span></p>
                    <p className="text-xs text-muted-foreground">Phone: <span className="text-foreground font-mono">{paymentDetails.telebirrPhone}</span></p>
                  </div>
                )}
                {paymentMethods.includes("mpessa") && paymentDetails.mpessaPhone && (
                  <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-1">
                    <p className="text-xs font-semibold text-primary">Mpessa</p>
                    <p className="text-xs text-muted-foreground">Name: <span className="text-foreground">{paymentDetails.mpessaName}</span></p>
                    <p className="text-xs text-muted-foreground">Phone: <span className="text-foreground font-mono">{paymentDetails.mpessaPhone}</span></p>
                  </div>
                )}
                {paymentDetails.instructions && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-semibold text-primary mb-1">Instructions</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{paymentDetails.instructions}</p>
                  </div>
                )}
              </div>
            )}

            {/* Transaction number + receipt */}
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
                <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary p-3 cursor-pointer hover:border-primary transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{receiptFile ? receiptFile.name : "Click to upload receipt"}</span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setReceiptFile(e.target.files?.[0] || null)} />
                </label>
                {receiptFile && (
                  <Button size="sm" variant="ghost" className="text-xs text-destructive h-7" onClick={() => setReceiptFile(null)}>
                    <X className="h-3 w-3 mr-1" /> Remove
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>Your upgrade request will be reviewed by admin before activation.</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStep("plan"); setUpgradeToPlan(null); setUpgradeReason(""); }} className="flex-1 border-border">Back</Button>
                <Button
                  onClick={handleSubmitPayment}
                  disabled={submitting || (!transactionNumber && !receiptFile) || !upgradeReason.trim()}
                  className="flex-1 bg-gradient-gold text-primary-foreground"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CreditCard className="h-4 w-4 mr-1" />}
                  Submit Upgrade Request
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Payment (new subscription) */}
        {step === "payment" && selectedPlan && (
          <div className="max-w-md mx-auto space-y-5">
            <div className="rounded-lg border border-border bg-secondary p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{selectedPlan.name} Plan</span>
                <span className="text-foreground font-semibold">{selectedPlan.price} ETB</span>
              </div>
              {Object.entries(selectedAddons).filter(([, v]) => v).map(([id]) => {
                const addon = ADDONS.find(a => a.id === id);
                if (!addon) return null;
                return (
                  <div key={id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{addon.name}</span>
                    <span className="text-foreground">{addon.price} ETB</span>
                  </div>
                );
              })}
              <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
                <span className="text-foreground">Total</span>
                <span className="text-primary">{totalAmount.toLocaleString()} ETB</span>
              </div>
            </div>

            {paymentMethods.length > 0 && (
              <div className="space-y-3 text-left">
                <h4 className="text-sm font-semibold text-foreground">Payment Methods</h4>
                {paymentMethods.includes("bank_transfer") && paymentDetails.bankName && (
                  <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-1">
                    <p className="text-xs font-semibold text-primary">Bank Transfer</p>
                    <p className="text-xs text-muted-foreground">Bank: <span className="text-foreground">{paymentDetails.bankName}</span></p>
                    <p className="text-xs text-muted-foreground">Account: <span className="text-foreground font-mono">{paymentDetails.bankAccount}</span></p>
                    {paymentDetails.bankHolder && <p className="text-xs text-muted-foreground">Name: <span className="text-foreground">{paymentDetails.bankHolder}</span></p>}
                  </div>
                )}
                {paymentMethods.includes("telebirr") && paymentDetails.telebirrPhone && (
                  <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-1">
                    <p className="text-xs font-semibold text-primary">Telebirr</p>
                    <p className="text-xs text-muted-foreground">Name: <span className="text-foreground">{paymentDetails.telebirrName}</span></p>
                    <p className="text-xs text-muted-foreground">Phone: <span className="text-foreground font-mono">{paymentDetails.telebirrPhone}</span></p>
                  </div>
                )}
                {paymentMethods.includes("mpessa") && paymentDetails.mpessaPhone && (
                  <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-1">
                    <p className="text-xs font-semibold text-primary">Mpessa</p>
                    <p className="text-xs text-muted-foreground">Name: <span className="text-foreground">{paymentDetails.mpessaName}</span></p>
                    <p className="text-xs text-muted-foreground">Phone: <span className="text-foreground font-mono">{paymentDetails.mpessaPhone}</span></p>
                  </div>
                )}
                {paymentDetails.instructions && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-semibold text-primary mb-1">Instructions</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{paymentDetails.instructions}</p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 border-t border-border pt-3">
              <h4 className="text-sm font-semibold text-foreground">Confirm Your Payment</h4>
              <div className="space-y-1">
                <Label className="text-xs">Transaction Number</Label>
                <Input value={transactionNumber} onChange={e => setTransactionNumber(e.target.value)} placeholder="Enter your transaction/reference number" className="border-border bg-secondary text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Upload Receipt (optional)</Label>
                <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary p-3 cursor-pointer hover:border-primary transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{receiptFile ? receiptFile.name : "Click to upload receipt"}</span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setReceiptFile(e.target.files?.[0] || null)} />
                </label>
                {receiptFile && (
                  <Button size="sm" variant="ghost" className="text-xs text-destructive h-7" onClick={() => setReceiptFile(null)}>
                    <X className="h-3 w-3 mr-1" /> Remove
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>After submitting, the admin will review and activate your account.</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("plan")} className="flex-1 border-border">Back</Button>
                <Button onClick={handleSubmitPayment} disabled={submitting || (!transactionNumber && !receiptFile)} className="flex-1 bg-gradient-gold text-primary-foreground">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CreditCard className="h-4 w-4 mr-1" />}
                  I've Made the Payment
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Done */}
        {step === "done" && (
          <div className="max-w-md mx-auto text-center space-y-5 py-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="font-display text-lg font-bold text-foreground">
                {upgradeToPlan ? "Upgrade Request Submitted!" : "Payment Submitted Successfully!"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {upgradeToPlan
                  ? "Your upgrade request is under review. The admin will verify your payment and upgrade your plan."
                  : "Your payment is under review. The admin will verify your transaction and activate your account."}
              </p>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center justify-center gap-2 text-primary">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-semibold">Waiting for Admin Approval</span>
              </div>
              <p className="text-xs text-muted-foreground">
                This usually takes a few hours. You'll be notified once approved.
              </p>
            </div>
            <Button onClick={handleClose} className="w-full bg-gradient-gold text-primary-foreground">
              Got It
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanPromptDialog;

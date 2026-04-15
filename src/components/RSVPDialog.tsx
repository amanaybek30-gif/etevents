import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, CheckCircle, Loader2, Info, ArrowLeft, ArrowRight, PartyPopper } from "lucide-react";
import type { CustomQuestion } from "@/components/organizer/OrganizerCreateEvent";
import TelegramPostRegPrompt from "@/components/TelegramPostRegPrompt";
import { getRemainingSlots } from "@/lib/registrationLimits";

interface BankInfo { bank: string; otherBank?: string; accountNumber: string; accountName: string; }
interface MobileInfo { name: string; phone: string; }
interface PaymentInfoStructured { bankTransfer?: BankInfo[]; telebirr?: MobileInfo; mpessa?: MobileInfo; qrCodeUrl?: string; }

interface TicketTier {
  id: string;
  name: string;
  price: string;
  description: string;
}

interface RegistrationFields {
  full_name?: boolean;
  email?: boolean;
  phone?: boolean;
  attendee_type?: boolean;
}

interface RSVPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTitle: string;
  eventSlug: string;
  eventId: string;
  ticketPrice: string;
  acceptedPaymentMethods?: string[];
  paymentInfo?: PaymentInfoStructured | null;
  paymentInstructions?: string | null;
  ticketTiers?: TicketTier[] | null;
  ticketOnlyMode?: boolean;
  preSelectedTier?: string;
  registrationFields?: RegistrationFields;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer", telebirr: "Telebirr", mpessa: "Mpessa", api_integration: "Online Payment (API)",
};

const PUBLIC_ATTENDEE_TYPES = [
  { value: "participant", label: "Participant" },
  { value: "vendor", label: "Vendor" },
  { value: "other", label: "Other" },
];

const generateTicketReference = () => {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 8)
      : Math.random().toString(36).replace(/[^a-z0-9]/gi, "").slice(0, 8);

  return `TKT-${randomPart.toUpperCase().padEnd(8, "X")}`;
};

const RSVPDialog = ({
  open, onOpenChange, eventTitle, eventSlug, eventId, ticketPrice,
  acceptedPaymentMethods = [], paymentInfo, paymentInstructions, ticketTiers, ticketOnlyMode = false,
  preSelectedTier, registrationFields,
}: RSVPDialogProps) => {
  const defaultFields: RegistrationFields = { full_name: true, email: true, phone: true, attendee_type: true };
  const fields = { ...defaultFields, ...registrationFields };
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [attendeeType, setAttendeeType] = useState("participant");
  const [selectedTier, setSelectedTier] = useState(preSelectedTier || "");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [bankName, setBankName] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [transactionNumber, setTransactionNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [registrationId, setRegistrationId] = useState("");
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string | string[]>>({});
  const [page, setPage] = useState(0);
  const [explorerProfile, setExplorerProfile] = useState<{ full_name: string; email: string; phone: string | null } | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const hasTiers = ticketTiers && ticketTiers.length > 0;
  const selectedTierObj = hasTiers ? ticketTiers.find(t => t.id === selectedTier) : null;
  const effectivePrice = selectedTierObj ? selectedTierObj.price : ticketPrice;
  const isFree = effectivePrice === "Free";
  const isApiPayment = paymentMethod === "api_integration";
  const hasCustomQuestions = customQuestions.length > 0;
  const hasPayment = !isFree;

  // Split custom questions into chunks of 4
  const QUESTIONS_PER_PAGE = 4;
  const questionChunks: CustomQuestion[][] = [];
  if (hasCustomQuestions) {
    for (let i = 0; i < customQuestions.length; i += QUESTIONS_PER_PAGE) {
      questionChunks.push(customQuestions.slice(i, i + QUESTIONS_PER_PAGE));
    }
  }

  // Build pages array — skip personal page for ticket-only mode or logged-in explorers with no custom questions
  // Also check if any personal fields are enabled
  const anyPersonalFieldEnabled = fields.full_name || fields.email || fields.phone || fields.attendee_type;
  const canSkipPersonal = ticketOnlyMode || !anyPersonalFieldEnabled || (!!explorerProfile && !hasCustomQuestions);
  const tierPreSelected = hasTiers && !!preSelectedTier;
  const pages: string[] = [];
  if (!canSkipPersonal) pages.push("personal");
  if (!ticketOnlyMode) {
    for (let i = 0; i < questionChunks.length; i++) {
      pages.push(`questions_${i}`);
    }
  }
  // Only show tiers page if tiers exist and none was pre-selected
  if (hasTiers && canSkipPersonal && !tierPreSelected) pages.push("tiers");
  if (hasPayment) pages.push("payment");
  // If free event with no custom questions and no tiers, explorer skips everything — ensure at least one page
  if (pages.length === 0) pages.push("confirm");

  const currentPage = pages[page] || pages[0];
  const isLastPage = page === pages.length - 1;
  const totalPages = pages.length;

  // Load explorer profile if logged in — instant auto-fill
  useEffect(() => {
    if (!open) return;
    setProfileLoaded(false);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setExplorerProfile(null); setProfileLoaded(true); return; }
      supabase.from("attendee_accounts")
        .select("full_name, email, phone")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data: account }) => {
          if (account) {
            setExplorerProfile(account);
            setFullName(account.full_name);
            setEmail(account.email);
            setPhone(account.phone || "");
            toast.info("Your information has been auto-filled from your profile.", { duration: 3000 });
          } else {
            setExplorerProfile(null);
          }
          setProfileLoaded(true);
        });
    });
  }, [open]);

  useEffect(() => {
    if (!open || !eventId) return;
    const loadQuestions = async () => {
      const { data } = await supabase.from("events").select("custom_questions").eq("id", eventId).single();
      if (data?.custom_questions && Array.isArray(data.custom_questions)) {
        setCustomQuestions(data.custom_questions as unknown as CustomQuestion[]);
      } else {
        setCustomQuestions([]);
      }
    };
    loadQuestions();
  }, [eventId, open]);

  const availableBanks: BankInfo[] = paymentInfo?.bankTransfer?.filter(b => b.bank || b.accountNumber) || [];

  const getPaymentAccount = () => {
    if (paymentMethod === "bank_transfer" && bankName && paymentInfo?.bankTransfer) {
      const bank = paymentInfo.bankTransfer.find(b => (b.bank === "Other" ? b.otherBank : b.bank) === bankName);
      if (bank) return { name: bank.accountName, account: bank.accountNumber };
    }
    if (paymentMethod === "telebirr" && paymentInfo?.telebirr) return { name: paymentInfo.telebirr.name, account: paymentInfo.telebirr.phone };
    if (paymentMethod === "mpessa" && paymentInfo?.mpessa) return { name: paymentInfo.mpessa.name, account: paymentInfo.mpessa.phone };
    return null;
  };

  const paymentAccount = getPaymentAccount();

  const resetForm = () => {
    setFullName(""); setPhone(""); setEmail(""); setPaymentMethod("");
    setBankName(""); setReceiptFile(null); setTransactionNumber(""); setSuccess(false);
    setAttendeeType("participant"); setSelectedTier(preSelectedTier || ""); setCustomAnswers({}); setPage(0);
    setRegistrationId(""); setExplorerProfile(null); setProfileLoaded(false);
  };

  // Track abandoned registration when user enters email + leaves without completing
  const saveAbandonedRegistration = async (capturedEmail: string, capturedName: string) => {
    if (!capturedEmail || !eventId || !eventSlug || success) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(capturedEmail)) return;
    try {
      const { error } = await supabase.from("abandoned_registrations").upsert(
        {
          email: capturedEmail.toLowerCase(),
          full_name: capturedName || null,
          event_id: eventId,
          event_slug: eventSlug,
          event_title: eventTitle,
          converted: false,
        },
        { onConflict: "email,event_id", ignoreDuplicates: false }
      );
      if (error) console.error("Abandoned registration tracking error:", error);
    } catch (err) {
      console.error("Abandoned registration tracking exception:", err);
    }
  };

  const markAbandonedConverted = async () => {
    if (!email || !eventId) return;
    try {
      await supabase
        .from("abandoned_registrations")
        .update({ converted: true })
        .eq("email", email.toLowerCase())
        .eq("event_id", eventId);
    } catch {
      // best-effort
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      // Capture values before resetForm clears them
      const capturedEmail = email;
      const capturedName = fullName;
      // If closing without success, track as abandoned
      if (!success && capturedEmail) {
        saveAbandonedRegistration(capturedEmail, capturedName);
      }
      resetForm();
    }
    onOpenChange(val);
  };

  const updateCustomAnswer = (questionId: string, value: string | string[]) => {
    setCustomAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const validatePersonalInfo = () => {
    if (fields.full_name && !fullName) { toast.error("Please enter your full name."); return false; }
    if (fields.phone && !phone) { toast.error("Please enter your phone number."); return false; }
    if (fields.email && !email) { toast.error("Please enter your email."); return false; }
    if (hasTiers && !tierPreSelected && !selectedTier) { toast.error("Please select a ticket type."); return false; }
    return true;
  };

  const validateTiers = () => {
    if (hasTiers && !selectedTier) { toast.error("Please select a ticket type."); return false; }
    if (ticketOnlyMode && !email) { toast.error("Please enter your email for ticket delivery."); return false; }
    return true;
  };

  const validateCustomQuestions = (chunk?: CustomQuestion[]) => {
    const qs = chunk || customQuestions;
    for (const q of qs) {
      if (q.required) {
        const answer = customAnswers[q.id];
        if (!answer || (Array.isArray(answer) && answer.length === 0) || (typeof answer === "string" && !answer.trim())) {
          toast.error(`Please answer: "${q.label}"`); return false;
        }
      }
    }
    return true;
  };

  const handleNext = () => {
    if (currentPage === "personal" && !validatePersonalInfo()) return;
    if (currentPage.startsWith("questions_")) {
      const chunkIdx = parseInt(currentPage.split("_")[1]);
      if (!validateCustomQuestions(questionChunks[chunkIdx])) return;
    }
    if (currentPage === "tiers" && !validateTiers()) return;
    setPage(p => p + 1);
  };

  const handleBack = () => setPage(p => Math.max(0, p - 1));

  const handleSubmit = async () => {
    if (currentPage === "personal" && !validatePersonalInfo()) return;
    if (currentPage.startsWith("questions_")) {
      const chunkIdx = parseInt(currentPage.split("_")[1]);
      if (!validateCustomQuestions(questionChunks[chunkIdx])) return;
    }
    if (currentPage === "tiers" && !validateTiers()) return;
    if (hasPayment) {
      if (!paymentMethod) { toast.error("Please select a payment method."); return; }
      if (paymentMethod === "bank_transfer" && !bankName) { toast.error("Please select a bank."); return; }
      if (!isApiPayment && !receiptFile && !transactionNumber.trim()) { toast.error("Please upload a receipt or enter a transaction number."); return; }
    }

    // For ticket-only mode, require email for ticket delivery
    const effectiveEmail = ticketOnlyMode ? (email || `ticket-${Date.now()}@self.local`) : email;
    const effectiveName = ticketOnlyMode ? (fullName || "Ticket Buyer") : fullName;
    const effectivePhone = ticketOnlyMode ? (phone || "N/A") : phone;

    setSubmitting(true);
    try {
      // Check organizer registration limit
      const remaining = await getRemainingSlots(eventId);
      if (remaining <= 0) {
        toast.error("Registration is currently full. The organizer has reached their attendee limit.");
        setSubmitting(false);
        return;
      }
      let receiptUrl = "";
      if (receiptFile) {
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (!ALLOWED_TYPES.includes(receiptFile.type)) { toast.error("Invalid file type."); setSubmitting(false); return; }
        if (receiptFile.size > MAX_FILE_SIZE) { toast.error("File too large. Max 10MB."); setSubmitting(false); return; }
        const mimeToExt: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'application/pdf': 'pdf' };
        const fileExt = mimeToExt[receiptFile.type] || 'bin';
        const filePath = `${eventSlug}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("receipts").upload(filePath, receiptFile);
        if (uploadError) throw uploadError;
        receiptUrl = filePath;
      }

      const ticketReference = generateTicketReference();

      // Use pre-selected tier if available
      const finalTierObj = selectedTierObj || (tierPreSelected && hasTiers ? ticketTiers.find(t => t.id === preSelectedTier) : null);

      const insertData: Record<string, unknown> = {
        event_id: eventId, event_slug: eventSlug, full_name: effectiveName, email: effectiveEmail, phone: effectivePhone,
        attendee_type: attendeeType,
        ticket_id: ticketReference,
        payment_method: isFree ? "free" : paymentMethod === "bank_transfer" ? `bank_transfer:${bankName}` : paymentMethod,
        bank_name: paymentMethod === "bank_transfer" ? bankName : null,
        receipt_url: receiptUrl || null,
        custom_answers: Object.keys(customAnswers).length > 0 || finalTierObj || transactionNumber.trim()
          ? { ...customAnswers, ...(finalTierObj ? { ticket_tier: finalTierObj.name, ticket_tier_price: finalTierObj.price } : {}), ...(transactionNumber.trim() ? { transaction_number: transactionNumber.trim() } : {}) }
          : null,
      };

      const { error } = await supabase.from("registrations").insert(insertData as any);
      if (error) throw error;

      setRegistrationId(ticketReference);
      setSuccess(true);

      // Mark abandoned registration as converted
      markAbandonedConverted();

      try {
        await supabase.functions.invoke("send-registration-email", {
          body: { eventTitle, eventSlug, fullName, email, attendeeType, tierName: finalTierObj?.name || null },
        });
      } catch { /* best-effort */ }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderPageIndicator = () => (
    <div className="flex items-center justify-center gap-2 pt-2">
      {pages.map((_, i) => (
        <div key={i} className={`h-1.5 rounded-full transition-all ${i === page ? "w-6 bg-primary" : i < page ? "w-4 bg-primary/40" : "w-4 bg-border"}`} />
      ))}
    </div>
  );

  const renderPersonalPage = () => (
    <div className="space-y-4">
      {explorerProfile && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">Your profile info has been auto-filled from your account.</p>
        </div>
      )}
      {/* Pre-selected tier info */}
      {tierPreSelected && selectedTierObj && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
          <p className="text-xs text-muted-foreground">Selected Ticket</p>
          <p className="text-sm font-semibold text-foreground">{selectedTierObj.name} — <span className="text-primary">{selectedTierObj.price}</span></p>
        </div>
      )}
      {fields.full_name && (
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name *</Label>
          <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter your full name" className="border-border bg-secondary" />
        </div>
      )}
      {fields.phone && (
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number *</Label>
          <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+251 9XX XXX XXX" className="border-border bg-secondary" />
        </div>
      )}
      {fields.email && (
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="border-border bg-secondary" />
        </div>
      )}
      {fields.attendee_type && (
        <div className="space-y-2">
          <Label>Attending As *</Label>
          <Select value={attendeeType} onValueChange={setAttendeeType}>
            <SelectTrigger className="border-border bg-secondary"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PUBLIC_ATTENDEE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {hasTiers && !tierPreSelected && (
        <div className="space-y-2">
          <Label>Ticket Type *</Label>
          <Select value={selectedTier} onValueChange={setSelectedTier}>
            <SelectTrigger className="border-border bg-secondary"><SelectValue placeholder="Select ticket type" /></SelectTrigger>
            <SelectContent>
              {ticketTiers!.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} — {t.price}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTierObj?.description && (
            <p className="text-xs text-muted-foreground">{selectedTierObj.description}</p>
          )}
        </div>
      )}
    </div>
  );

  const renderQuestionsPage = (chunk: CustomQuestion[], chunkIdx: number) => (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Additional Information{questionChunks.length > 1 ? ` (${chunkIdx + 1}/${questionChunks.length})` : ""}
      </p>
      {chunk.map(q => (
        <div key={q.id} className="space-y-1.5">
          <Label className="text-sm">{q.label} {q.required && <span className="text-destructive">*</span>}</Label>
          {q.type === "short_answer" && (
            <Input value={(customAnswers[q.id] as string) || ""} onChange={e => updateCustomAnswer(q.id, e.target.value)} placeholder="Your answer..." className="border-border bg-card" />
          )}
          {q.type === "long_answer" && (
            <textarea value={(customAnswers[q.id] as string) || ""} onChange={e => updateCustomAnswer(q.id, e.target.value)} placeholder="Your answer..." className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" rows={3} />
          )}
          {q.type === "multiple_choice" && (
            <div className="space-y-1.5">
              {(q.options || []).map((opt, i) => (
                <label key={i} className={`flex items-center gap-2 rounded-md border p-2 cursor-pointer text-sm transition-colors ${customAnswers[q.id] === opt ? "border-primary bg-primary/5 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/50"}`}>
                  <input type="radio" name={q.id} value={opt} checked={customAnswers[q.id] === opt} onChange={() => updateCustomAnswer(q.id, opt)} className="accent-primary" />
                  {opt}
                </label>
              ))}
            </div>
          )}
          {q.type === "checkbox" && (
            <div className="space-y-1.5">
              {(q.options || []).map((opt, i) => {
                const selected = Array.isArray(customAnswers[q.id]) ? (customAnswers[q.id] as string[]) : [];
                return (
                  <label key={i} className={`flex items-center gap-2 rounded-md border p-2 cursor-pointer text-sm transition-colors ${selected.includes(opt) ? "border-primary bg-primary/5 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/50"}`}>
                    <Checkbox checked={selected.includes(opt)} onCheckedChange={checked => {
                      if (checked) updateCustomAnswer(q.id, [...selected, opt]);
                      else updateCustomAnswer(q.id, selected.filter(s => s !== opt));
                    }} />
                    {opt}
                  </label>
                );
              })}
            </div>
          )}
          {q.type === "dropdown" && (
            <Select value={(customAnswers[q.id] as string) || ""} onValueChange={v => updateCustomAnswer(q.id, v)}>
              <SelectTrigger className="border-border bg-card"><SelectValue placeholder="Select an option" /></SelectTrigger>
              <SelectContent>{(q.options || []).map((opt, i) => <SelectItem key={i} value={opt}>{opt}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      ))}
    </div>
  );

  const renderTiersPage = () => (
    <div className="space-y-4">
      {explorerProfile && !ticketOnlyMode && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
          <p className="text-xs text-muted-foreground">Registering as</p>
          <p className="text-sm font-semibold text-foreground">{explorerProfile.full_name}</p>
          <p className="text-xs text-muted-foreground">{explorerProfile.email}</p>
        </div>
      )}
      <div className="space-y-2">
        <Label>Ticket Type *</Label>
        <Select value={selectedTier} onValueChange={setSelectedTier}>
          <SelectTrigger className="border-border bg-secondary"><SelectValue placeholder="Select ticket type" /></SelectTrigger>
          <SelectContent>
            {ticketTiers!.map(t => (
              <SelectItem key={t.id} value={t.id}>
                {t.name} — {t.price}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedTierObj?.description && (
          <p className="text-xs text-muted-foreground">{selectedTierObj.description}</p>
        )}
      </div>
      {ticketOnlyMode && (
        <div className="space-y-2">
          <Label>Email (for ticket delivery) *</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="border-border bg-secondary" />
          <p className="text-xs text-muted-foreground">Your ticket will be sent to this email after payment confirmation.</p>
        </div>
      )}
    </div>
  );

  const renderConfirmPage = () => (
    <div className="space-y-4 text-center py-4">
      {explorerProfile && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Registering as</p>
          <p className="text-sm font-semibold text-foreground">{explorerProfile.full_name}</p>
          <p className="text-xs text-muted-foreground">{explorerProfile.email}{explorerProfile.phone ? ` · ${explorerProfile.phone}` : ""}</p>
        </div>
      )}
      <p className="text-sm text-muted-foreground">This is a free event. Click submit to complete your registration.</p>
    </div>
  );

  const renderPaymentPage = () => (
    <div className="space-y-4">
      {paymentInstructions && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Payment Instructions</p>
            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">{paymentInstructions}</p>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label>Payment Method *</Label>
        <Select value={paymentMethod} onValueChange={v => { setPaymentMethod(v); setBankName(""); }}>
          <SelectTrigger className="border-border bg-secondary"><SelectValue placeholder="Select payment method" /></SelectTrigger>
          <SelectContent>
            {acceptedPaymentMethods.map(m => <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m] || m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {paymentMethod === "bank_transfer" && availableBanks.length > 0 && (
        <div className="space-y-2">
          <Label>Select Bank *</Label>
          <Select value={bankName} onValueChange={setBankName}>
            <SelectTrigger className="border-border bg-secondary"><SelectValue placeholder="Select bank" /></SelectTrigger>
            <SelectContent>
              {availableBanks.map((b, idx) => {
                const displayName = b.bank === "Other" ? (b.otherBank || "Other Bank") : b.bank;
                return <SelectItem key={idx} value={displayName}>{displayName}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {paymentAccount && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Send payment to:</p>
          <p className="text-sm font-semibold text-foreground">{paymentAccount.name}</p>
          <p className="font-mono text-lg font-bold text-primary">{paymentAccount.account}</p>
        </div>
      )}

      {paymentInfo?.qrCodeUrl && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center space-y-2">
          <p className="text-xs text-muted-foreground">Scan to Pay</p>
          <img src={paymentInfo.qrCodeUrl} alt="Payment QR Code" className="mx-auto max-h-40 rounded" />
        </div>
      )}

      {isApiPayment && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm text-muted-foreground">Online payment integration coming soon.</p>
        </div>
      )}

      {!isApiPayment && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Upload Payment Receipt</Label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-secondary p-4 transition-colors hover:border-primary">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{receiptFile ? receiptFile.name : "Upload receipt (image or PDF)"}</span>
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setReceiptFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-2">
            <Label>Transaction Number</Label>
            <Input value={transactionNumber} onChange={e => setTransactionNumber(e.target.value)} placeholder="Enter your transaction/reference number" className="border-border bg-secondary" />
          </div>
          <p className="text-xs text-muted-foreground">Provide either a receipt screenshot or your transaction number for verification.</p>
        </div>
      )}
    </div>
  );

  const renderSuccessPage = () => (
    <div className="space-y-6 py-6 text-center">
      <PartyPopper className="mx-auto h-16 w-16 text-primary" />
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">
          {ticketOnlyMode ? "Ticket Purchase Submitted!" : "Thank You for Registering!"}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {ticketOnlyMode
            ? <>Your ticket for <span className="font-semibold text-primary">{eventTitle}</span> has been submitted for confirmation.</>
            : <>You have successfully registered for <span className="font-semibold text-primary">{eventTitle}</span>.</>
          }
        </p>
      </div>
      <div className="rounded-lg border border-border bg-secondary/50 p-4 space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{ticketOnlyMode ? "Your Order ID" : "Your Registration ID"}</p>
        <p className="font-mono text-lg font-bold text-primary select-all">{registrationId.slice(0, 8).toUpperCase()}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        {ticketOnlyMode
          ? <>Your ticket will be sent to <span className="font-medium text-foreground">{email || "your email"}</span> once approved.</>
          : <>A confirmation email will be sent to <span className="font-medium text-foreground">{email}</span>. You'll receive your QR code ticket once approved.</>
        }
      </p>
      {!ticketOnlyMode && <TelegramPostRegPrompt />}
      <Button onClick={() => handleClose(false)} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90 py-5 text-base">
        Done
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-lg">
        {success ? renderSuccessPage() : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl text-foreground">{ticketOnlyMode ? "Get Your Ticket" : tierPreSelected && selectedTierObj ? `Get ${selectedTierObj.name} Ticket` : "RSVP Your Spot"}</DialogTitle>
              <p className="text-sm text-muted-foreground">{eventTitle} — {tierPreSelected && selectedTierObj ? selectedTierObj.price : effectivePrice || ticketPrice}</p>
              {totalPages > 1 && renderPageIndicator()}
            </DialogHeader>

            <div className="pt-2 min-h-[200px]">
              {currentPage === "personal" && renderPersonalPage()}
              {currentPage.startsWith("questions_") && (() => {
                const chunkIdx = parseInt(currentPage.split("_")[1]);
                return renderQuestionsPage(questionChunks[chunkIdx], chunkIdx);
              })()}
              {currentPage === "tiers" && renderTiersPage()}
              {currentPage === "payment" && renderPaymentPage()}
              {currentPage === "confirm" && renderConfirmPage()}
            </div>

            <div className="flex gap-2 pt-4">
              {page > 0 && (
                <Button variant="outline" onClick={handleBack} className="border-border">
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
              )}
              <div className="flex-1" />
              {!isLastPage ? (
                <Button onClick={handleNext} className="bg-gradient-gold text-primary-foreground hover:opacity-90">
                  Next <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting || isApiPayment} className="bg-gradient-gold text-primary-foreground hover:opacity-90 flex-1 py-5 text-base">
                  {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  {submitting ? "Submitting..." : ticketOnlyMode ? "Complete Purchase" : "Submit Registration"}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RSVPDialog;

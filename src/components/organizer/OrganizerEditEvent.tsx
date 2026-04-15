import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Loader2, QrCode, Image as ImageIcon, X, Save, ArrowLeft, Plus, Store, Users, Trash2, Calendar, Video } from "lucide-react";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import type { OrganizerSection } from "./OrganizerSidebar";
import TicketTiersEditor, { type TicketTier } from "./TicketTiersEditor";
import VendorPricingEditor, { type VendorPackage } from "./VendorPricingEditor";
import EventMaterialsEditor, { type EventMaterial } from "./EventMaterialsEditor";

const CATEGORIES = ["General", "Concert", "Conference", "Cultural", "Technology", "Fashion", "Business", "Sports", "Charity", "Other"];
const BANKS = ["Commercial Bank of Ethiopia", "Bank of Abyssinia", "Dashen Bank", "Awash Bank", "Other"];

interface BankPaymentInfo { bank: string; otherBank?: string; accountNumber: string; accountName: string; }
interface MobilePaymentInfo { name: string; phone: string; }
interface PaymentDetails { bankTransfer?: BankPaymentInfo[]; telebirr?: MobilePaymentInfo; mpessa?: MobilePaymentInfo; qrCodeUrl?: string; }

interface Props {
  userId: string;
  eventId: string;
  onNavigate: (section: OrganizerSection) => void;
}

const OrganizerEditEvent = ({ userId, eventId, onNavigate }: Props) => {
  const [eventForm, setEventForm] = useState({
    title: "", slug: "", category: "General", date: "", end_date: "", time: "",
    location: "", map_link: "", duration: "", ticket_price: "Free",
    short_description: "", about: "", details: "", what_to_expect: "",
    other_category: "", host: "", partners: "", expected_attendees: "",
    payment_instructions: "",
  });
  const [acceptedPayments, setAcceptedPayments] = useState<string[]>([]);
  const [bankPayments, setBankPayments] = useState<BankPaymentInfo[]>([{ bank: "", otherBank: "", accountNumber: "", accountName: "" }]);
  const [telebirrInfo, setTelebirrInfo] = useState<MobilePaymentInfo>({ name: "", phone: "" });
  const [mpessaInfo, setMpessaInfo] = useState<MobilePaymentInfo>({ name: "", phone: "" });
  const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [existingQrUrl, setExistingQrUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);
  const [vendorRegEnabled, setVendorRegEnabled] = useState(false);
  const [waitlistEnabled, setWaitlistEnabled] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [registrationClosedReason, setRegistrationClosedReason] = useState("");
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([]);
  const [ticketOnlyMode, setTicketOnlyMode] = useState(false);
  const [registrationFieldsConfig, setRegistrationFieldsConfig] = useState({ full_name: true, email: true, phone: true, attendee_type: true });
  const [vendorPackages, setVendorPackages] = useState<VendorPackage[]>([]);
  const [speakers, setSpeakers] = useState<{ name: string; title: string; bio: string; statement: string; photo_url: string; role: string }[]>([]);
  const [eventMaterials, setEventMaterials] = useState<EventMaterial[]>([]);
  const [isPostponed, setIsPostponed] = useState(false);
  const [postponedDate, setPostponedDate] = useState("");
  const [postponedLocation, setPostponedLocation] = useState("");
  const speakerPhotoRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { flags } = useFeatureFlags();
  const posterInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadEvent = async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId).eq("organizer_id", userId).single();
      if (error || !data) {
        toast.error("Event not found");
        onNavigate("events");
        return;
      }

      const isOtherCategory = !CATEGORIES.slice(0, -1).includes(data.category);
      setEventForm({
        title: data.title || "",
        slug: data.slug || "",
        category: isOtherCategory ? "Other" : data.category || "General",
        date: data.date || "",
        end_date: (data as any).end_date || "",
        time: data.time || "",
        location: data.location || "",
        map_link: (data as any).map_link || "",
        duration: data.duration || "",
        ticket_price: data.ticket_price || "Free",
        short_description: data.short_description || "",
        about: data.about || "",
        details: data.details || "",
        what_to_expect: data.what_to_expect ? data.what_to_expect.join("\n") : "",
        other_category: isOtherCategory ? data.category : "",
        host: data.host || "",
        partners: data.partners ? data.partners.join(", ") : "",
        expected_attendees: data.expected_attendees ? String(data.expected_attendees) : "",
        payment_instructions: (data as any).payment_instructions || "",
      });

      setVendorRegEnabled(!!data.vendor_registration_enabled);
      setWaitlistEnabled(!!(data as any).waitlist_enabled);
      setRegistrationEnabled((data as any).registration_enabled !== false);
      setRegistrationClosedReason((data as any).registration_closed_reason || "");
      setTicketOnlyMode(!!(data as any).ticket_only_mode);
      const rf = (data as any).registration_fields;
      if (rf && typeof rf === 'object') setRegistrationFieldsConfig({ full_name: rf.full_name !== false, email: rf.email !== false, phone: rf.phone !== false, attendee_type: rf.attendee_type !== false });
      // Load vendor pricing
      const vp = (data as any).vendor_pricing;
      if (Array.isArray(vp)) setVendorPackages(vp);
      // Load ticket tiers
      const tiers = (data as any).ticket_tiers;
      if (Array.isArray(tiers)) setTicketTiers(tiers);
      // Load speakers
      const spk = (data as any).speakers;
      if (Array.isArray(spk)) setSpeakers(spk.map((s: any) => ({ name: s.name || "", title: s.title || "", bio: s.bio || "", statement: s.statement || "", photo_url: s.photo_url || "", role: s.role || "speaker" })));
      const mats = (data as any).materials;
      if (Array.isArray(mats)) setEventMaterials(mats);
      setIsPostponed(!!(data as any).is_postponed);
      setPostponedDate((data as any).postponed_date || "");
      setPostponedLocation((data as any).postponed_location || "");
      setExistingImageUrl(data.image_url || null);
      if (data.image_url) setPosterPreview(data.image_url);
      setExistingVideoUrl((data as any).video_url || null);
      if ((data as any).video_url) setVideoPreview((data as any).video_url);

      const methods = (data as any).accepted_payment_methods || [];
      setAcceptedPayments(methods);

      const pi = (data as any).payment_info as PaymentDetails | null;
      if (pi) {
        if (pi.bankTransfer?.length) setBankPayments(pi.bankTransfer);
        if (pi.telebirr) setTelebirrInfo(pi.telebirr);
        if (pi.mpessa) setMpessaInfo(pi.mpessa);
        if (pi.qrCodeUrl) setExistingQrUrl(pi.qrCodeUrl);
      }

      setLoading(false);
    };
    loadEvent();
  }, [eventId, userId, onNavigate]);

  const togglePayment = (id: string) => setAcceptedPayments(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const handlePosterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPosterFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPosterPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { toast.error("Video must be under 100MB"); return; }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (acceptedPayments.length === 0 && eventForm.ticket_price !== "Free") {
      toast.error("Select at least one payment method");
      return;
    }
    setSaving(true);
    try {
      const category = eventForm.category === "Other" && eventForm.other_category ? eventForm.other_category : eventForm.category;

      let imageUrl = existingImageUrl || "";
      if (posterFile) {
        const ext = posterFile.name.split(".").pop();
        const path = `${eventForm.slug}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("event-posters").upload(path, posterFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("event-posters").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      let videoUrl = existingVideoUrl || "";
      if (videoFile) {
        const ext = videoFile.name.split(".").pop();
        const path = `vid-${eventForm.slug}-${Date.now()}.${ext}`;
        const { error: vidErr } = await supabase.storage.from("event-posters").upload(path, videoFile, { upsert: true });
        if (vidErr) throw vidErr;
        const { data: vidData } = supabase.storage.from("event-posters").getPublicUrl(path);
        videoUrl = vidData.publicUrl;
      }

      let qrCodeUrl = existingQrUrl || "";
      if (qrCodeFile) {
        const ext = qrCodeFile.name.split(".").pop();
        const path = `qr-${eventForm.slug}-${Date.now()}.${ext}`;
        const { error: qrErr } = await supabase.storage.from("event-posters").upload(path, qrCodeFile, { upsert: true });
        if (!qrErr) {
          const { data: qrUrl } = supabase.storage.from("event-posters").getPublicUrl(path);
          qrCodeUrl = qrUrl.publicUrl;
        }
      }

      const paymentInfo: PaymentDetails = {};
      if (acceptedPayments.includes("bank_transfer")) paymentInfo.bankTransfer = bankPayments.filter(b => b.bank || b.accountNumber);
      if (acceptedPayments.includes("telebirr")) paymentInfo.telebirr = telebirrInfo;
      if (acceptedPayments.includes("mpessa")) paymentInfo.mpessa = mpessaInfo;
      if (qrCodeUrl) paymentInfo.qrCodeUrl = qrCodeUrl;

      // Filter valid speakers
      const validSpeakers = speakers.filter(s => s.name.trim());

      const isFreeEvent = eventForm.ticket_price.toLowerCase() === "free" || eventForm.ticket_price.trim() === "" || eventForm.ticket_price.toLowerCase() === "at the door";

      const updateData: Record<string, unknown> = {
        title: eventForm.title,
        category,
        date: eventForm.date,
        end_date: eventForm.end_date || null,
        time: eventForm.time,
        location: eventForm.location, map_link: eventForm.map_link || null,
        duration: eventForm.duration || null,
        ticket_price: eventForm.ticket_price || "Free",
        short_description: eventForm.short_description || null,
        about: eventForm.about || null,
        details: eventForm.details || null,
        image_url: imageUrl || null, video_url: videoUrl || null,
        accepted_payment_methods: isFreeEvent ? ["free"] : acceptedPayments,
        payment_info: isFreeEvent ? null : paymentInfo,
        payment_instructions: isFreeEvent ? null : (eventForm.payment_instructions || null),
        host: eventForm.host || null,
        partners: eventForm.partners ? eventForm.partners.split(",").map(p => p.trim()).filter(Boolean) : null,
        expected_attendees: eventForm.expected_attendees ? parseInt(eventForm.expected_attendees) : null,
        what_to_expect: eventForm.what_to_expect ? eventForm.what_to_expect.split("\n").filter(Boolean) : null,
        vendor_registration_enabled: vendorRegEnabled,
        waitlist_enabled: waitlistEnabled,
        registration_enabled: registrationEnabled,
        registration_closed_reason: registrationEnabled ? null : (registrationClosedReason || null),
        ticket_only_mode: ticketOnlyMode,
        registration_fields: registrationFieldsConfig,
        vendor_pricing: vendorRegEnabled && vendorPackages.filter(p => p.name.trim() && p.price.trim()).length > 0
          ? vendorPackages.filter(p => p.name.trim() && p.price.trim())
          : null,
        ticket_tiers: ticketTiers.filter(t => t.name.trim() && t.price.trim()).length > 0
          ? ticketTiers.filter(t => t.name.trim() && t.price.trim())
          : null,
        speakers: validSpeakers.length > 0 ? validSpeakers : null,
        materials: eventMaterials.filter(m => m.title.trim() && m.url).length > 0
          ? eventMaterials.filter(m => m.title.trim() && m.url)
          : null,
        is_postponed: isPostponed,
        postponed_date: isPostponed && postponedDate ? postponedDate : null,
        postponed_location: isPostponed && postponedLocation ? postponedLocation : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("events").update(updateData as any).eq("id", eventId).eq("organizer_id", userId);
      if (error) throw error;

      toast.success("Event updated successfully!");
      onNavigate("events");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => onNavigate("events")} className="gap-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to My Events
      </Button>

      <form onSubmit={handleSave} className="mx-auto max-w-2xl space-y-6 rounded-xl border border-border bg-card p-4 sm:p-8">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">Edit Event</h2>

        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Basic Information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Event Name *</Label>
              <Input value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} placeholder="Enter event name" className="border-border bg-secondary" required />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={eventForm.category} onValueChange={v => setEventForm({ ...eventForm, category: v })}>
                <SelectTrigger className="border-border bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {eventForm.category === "Other" && (
              <div className="space-y-2">
                <Label>Specify Category *</Label>
                <Input value={eventForm.other_category} onChange={e => setEventForm({ ...eventForm, other_category: e.target.value })} placeholder="e.g. Sports" className="border-border bg-secondary" required />
              </div>
            )}
            <div className="space-y-2"><Label>Start Date *</Label><Input type="date" value={eventForm.date} onChange={e => setEventForm({ ...eventForm, date: e.target.value })} className="border-border bg-secondary" required /></div>
            <div className="space-y-2"><Label>End Date <span className="text-xs text-muted-foreground">(multi-day)</span></Label><Input type="date" value={eventForm.end_date} onChange={e => setEventForm({ ...eventForm, end_date: e.target.value })} className="border-border bg-secondary" min={eventForm.date || undefined} /></div>
            <div className="space-y-2"><Label>Time *</Label><Input value={eventForm.time} onChange={e => setEventForm({ ...eventForm, time: e.target.value })} placeholder="7:00 PM" className="border-border bg-secondary" required /></div>
            <div className="space-y-2"><Label>Location *</Label><Input value={eventForm.location} onChange={e => setEventForm({ ...eventForm, location: e.target.value })} placeholder="Venue, City" className="border-border bg-secondary" required /></div>
            
            <div className="space-y-2"><Label>Duration</Label><Input value={eventForm.duration} onChange={e => setEventForm({ ...eventForm, duration: e.target.value })} placeholder="3 hours" className="border-border bg-secondary" /></div>
            <div className="space-y-2"><Label>Expected Attendees</Label><Input type="number" value={eventForm.expected_attendees} onChange={e => setEventForm({ ...eventForm, expected_attendees: e.target.value })} placeholder="500" className="border-border bg-secondary" /></div>
            <div className="space-y-2"><Label>Ticket Price</Label><Input value={eventForm.ticket_price} onChange={e => setEventForm({ ...eventForm, ticket_price: e.target.value })} placeholder="Free or 500 ETB" className="border-border bg-secondary" /></div>
            <div className="space-y-2"><Label>Hosting Organization</Label><Input value={eventForm.host} onChange={e => setEventForm({ ...eventForm, host: e.target.value })} placeholder="Your organization" className="border-border bg-secondary" /></div>
            <div className="space-y-2"><Label>Partners</Label><Input value={eventForm.partners} onChange={e => setEventForm({ ...eventForm, partners: e.target.value })} placeholder="Partner A, Partner B" className="border-border bg-secondary" /><p className="text-xs text-muted-foreground">Comma separated</p></div>
          </div>
        </div>

        {/* Ticket Tiers */}
        <TicketTiersEditor tiers={ticketTiers} onChange={setTicketTiers} />

        {/* Speakers, Guests & MC */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Speakers, Guests & MC</h3>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs border-border hover:border-primary" onClick={() => setSpeakers([...speakers, { name: "", title: "", bio: "", statement: "", photo_url: "", role: "speaker" }])}>
              <Plus className="h-3 w-3 mr-1" /> Add Person
            </Button>
          </div>
          {speakers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-6 text-center">
              <p className="text-sm text-muted-foreground">No speakers, guests, or MCs added yet</p>
              <Button type="button" variant="ghost" size="sm" className="mt-2 text-primary hover:text-primary/80" onClick={() => setSpeakers([{ name: "", title: "", bio: "", statement: "", photo_url: "", role: "speaker" }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add your first person
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {speakers.map((s, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-secondary/50 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-muted-foreground font-semibold mt-1">#{idx + 1}</span>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {s.photo_url ? (
                            <div className="relative">
                              <img src={s.photo_url} alt={s.name} className="h-16 w-16 rounded-full object-cover border-2 border-primary/30" />
                              <button type="button" onClick={() => { const u = [...speakers]; u[idx].photo_url = ""; setSpeakers(u); }} className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"><X className="h-3 w-3" /></button>
                            </div>
                          ) : (
                            <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-border bg-card hover:border-primary transition-colors">
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={el => { speakerPhotoRefs.current[idx] = el; }}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const ext = file.name.split(".").pop();
                                  const path = `speaker-${Date.now()}-${idx}.${ext}`;
                                  const { error: uploadErr } = await supabase.storage.from("event-posters").upload(path, file, { upsert: true });
                                  if (uploadErr) { toast.error("Failed to upload photo"); return; }
                                  const { data: urlData } = supabase.storage.from("event-posters").getPublicUrl(path);
                                  const u = [...speakers]; u[idx].photo_url = urlData.publicUrl; setSpeakers(u);
                                }}
                              />
                            </label>
                          )}
                        </div>
                        <Input value={s.name} onChange={e => { const u = [...speakers]; u[idx].name = e.target.value; setSpeakers(u); }} placeholder="Full Name *" className="border-border bg-card" />
                      </div>
                      <Select value={s.role || "speaker"} onValueChange={v => { const u = [...speakers]; u[idx].role = v; setSpeakers(u); }}>
                        <SelectTrigger className="border-border bg-card"><SelectValue placeholder="Role" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="speaker">Speaker</SelectItem>
                          <SelectItem value="guest">Guest</SelectItem>
                          <SelectItem value="mc">MC / Host</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input value={s.title} onChange={e => { const u = [...speakers]; u[idx].title = e.target.value; setSpeakers(u); }} placeholder="Title & Job (e.g. CEO at Company)" className="border-border bg-card" />
                      <textarea value={s.bio} onChange={e => { const u = [...speakers]; u[idx].bio = e.target.value; setSpeakers(u); }} placeholder="Short bio / description..." className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" rows={2} />
                      <Input value={s.statement} onChange={e => { const u = [...speakers]; u[idx].statement = e.target.value; setSpeakers(u); }} placeholder="Statement (optional)" className="border-border bg-card" />
                    </div>
                    <button type="button" onClick={() => setSpeakers(speakers.filter((_, i) => i !== idx))} className="text-destructive hover:text-destructive/80 mt-1"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Poster */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Event Poster</h3>
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-secondary p-6 transition-colors hover:border-primary">
            {posterPreview ? (
              <div className="relative w-full">
                <img src={posterPreview} alt="Poster" className="max-h-48 w-full rounded-lg object-cover" />
                <button type="button" onClick={e => { e.preventDefault(); setPosterFile(null); setPosterPreview(null); setExistingImageUrl(null); }} className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground text-center">Click to upload poster<br /><span className="text-xs">JPG, PNG, WebP</span></span>
              </>
            )}
            <input ref={posterInputRef} type="file" accept="image/*" className="hidden" onChange={handlePosterChange} />
          </label>
        </div>

        {/* Payment Methods */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Payment Methods</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[{ id: "bank_transfer", label: "Bank Transfer" }, { id: "telebirr", label: "Telebirr" }, { id: "mpessa", label: "Mpessa" }].map(pm => (
              <label key={pm.id} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${acceptedPayments.includes(pm.id) ? "border-primary bg-primary/5" : "border-border bg-secondary hover:border-primary/50"}`}>
                <Checkbox checked={acceptedPayments.includes(pm.id)} onCheckedChange={() => togglePayment(pm.id)} />
                <span className="text-sm font-medium text-foreground">{pm.label}</span>
              </label>
            ))}
        </div>

        {/* Event Video */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Event Video (optional)</h3>
          <p className="text-xs text-muted-foreground">Upload a video to showcase past experiences or use as the event cover. Max 100MB.</p>
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-secondary p-6 transition-colors hover:border-primary">
            {videoPreview ? (
              <div className="relative w-full">
                <video src={videoPreview} className="max-h-48 w-full rounded-lg object-cover" controls muted />
                <button type="button" onClick={e => { e.preventDefault(); setVideoFile(null); setVideoPreview(null); setExistingVideoUrl(null); }} className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <>
                <Video className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground text-center">Click to upload video<br /><span className="text-xs">MP4, MOV, WebM (max 100MB)</span></span>
              </>
            )}
            <input type="file" accept="video/*" className="hidden" onChange={handleVideoChange} />
          </label>
        </div>

          {acceptedPayments.includes("bank_transfer") && (
            <div className="space-y-3 rounded-lg border border-border bg-secondary/50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Bank Transfer Details</p>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBankPayments([...bankPayments, { bank: "", otherBank: "", accountNumber: "", accountName: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Bank
                </Button>
              </div>
              {bankPayments.map((bp, idx) => (
                <div key={idx} className="space-y-2 rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Bank #{idx + 1}</span>
                    {bankPayments.length > 1 && <button type="button" onClick={() => setBankPayments(bankPayments.filter((_, i) => i !== idx))} className="text-destructive"><X className="h-4 w-4" /></button>}
                  </div>
                  <Select value={bp.bank} onValueChange={v => { const u = [...bankPayments]; u[idx].bank = v; setBankPayments(u); }}>
                    <SelectTrigger className="border-border bg-secondary h-9"><SelectValue placeholder="Select bank" /></SelectTrigger>
                    <SelectContent>{BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                  {bp.bank === "Other" && <Input placeholder="Bank name" value={bp.otherBank} onChange={e => { const u = [...bankPayments]; u[idx].otherBank = e.target.value; setBankPayments(u); }} className="border-border bg-secondary" />}
                  <Input placeholder="Account Number" value={bp.accountNumber} onChange={e => { const u = [...bankPayments]; u[idx].accountNumber = e.target.value; setBankPayments(u); }} className="border-border bg-secondary" />
                  <Input placeholder="Account Name" value={bp.accountName} onChange={e => { const u = [...bankPayments]; u[idx].accountName = e.target.value; setBankPayments(u); }} className="border-border bg-secondary" />
                </div>
              ))}
            </div>
          )}

          {acceptedPayments.includes("telebirr") && (
            <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-4">
              <p className="text-sm font-semibold text-foreground">Telebirr Details</p>
              <Input placeholder="Full Name" value={telebirrInfo.name} onChange={e => setTelebirrInfo({ ...telebirrInfo, name: e.target.value })} className="border-border bg-secondary" />
              <Input placeholder="Phone Number" value={telebirrInfo.phone} onChange={e => setTelebirrInfo({ ...telebirrInfo, phone: e.target.value })} className="border-border bg-secondary" />
            </div>
          )}

          {acceptedPayments.includes("mpessa") && (
            <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-4">
              <p className="text-sm font-semibold text-foreground">Mpessa Details</p>
              <Input placeholder="Full Name" value={mpessaInfo.name} onChange={e => setMpessaInfo({ ...mpessaInfo, name: e.target.value })} className="border-border bg-secondary" />
              <Input placeholder="Phone Number" value={mpessaInfo.phone} onChange={e => setMpessaInfo({ ...mpessaInfo, phone: e.target.value })} className="border-border bg-secondary" />
            </div>
          )}

          <div className="space-y-2">
            <Label>Payment QR Code (Optional)</Label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-secondary p-3 hover:border-primary">
              <QrCode className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{qrCodeFile ? qrCodeFile.name : existingQrUrl ? "QR code uploaded ✓ (click to replace)" : "Upload QR code"}</span>
              <input ref={qrInputRef} type="file" accept="image/*" className="hidden" onChange={e => setQrCodeFile(e.target.files?.[0] || null)} />
            </label>
            {(qrCodeFile || existingQrUrl) && (
              <button type="button" onClick={() => { setQrCodeFile(null); setExistingQrUrl(null); }} className="text-xs text-destructive hover:underline">Remove QR</button>
            )}
          </div>

          <div className="space-y-2">
            <Label>Payment Instructions (Optional)</Label>
            <textarea
              value={eventForm.payment_instructions}
              onChange={e => setEventForm({ ...eventForm, payment_instructions: e.target.value })}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder="e.g. Use your full name as payment reference."
            />
            <p className="text-xs text-muted-foreground">These instructions will be shown to attendees during registration</p>
          </div>
        </div>

        {/* Materials / Schedules / Agendas */}
        <EventMaterialsEditor materials={eventMaterials} onChange={setEventMaterials} />

        {/* Description */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Event Description</h3>
          <div className="space-y-2"><Label>Short Description</Label><Input value={eventForm.short_description} onChange={e => setEventForm({ ...eventForm, short_description: e.target.value })} placeholder="One-line summary" className="border-border bg-secondary" /></div>
          <div className="space-y-2"><Label>About</Label><textarea value={eventForm.about} onChange={e => setEventForm({ ...eventForm, about: e.target.value })} className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" rows={4} placeholder="Describe your event..." /></div>
          <div className="space-y-2"><Label>Details</Label><textarea value={eventForm.details} onChange={e => setEventForm({ ...eventForm, details: e.target.value })} className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" rows={3} placeholder="Schedule, speakers..." /></div>
          <div className="space-y-2"><Label>What to Expect</Label><textarea value={eventForm.what_to_expect} onChange={e => setEventForm({ ...eventForm, what_to_expect: e.target.value })} className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" rows={4} placeholder={"List each item on a new line\n• Live performances\n• Networking"} /><p className="text-xs text-muted-foreground">One item per line</p></div>
        </div>

        {flags.feature_vendor_registration && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Vendor Registration</p>
                  <p className="text-xs text-muted-foreground mt-1">Allow vendors/exhibitors to apply for booths at this event</p>
                </div>
              </div>
              <Switch checked={vendorRegEnabled} onCheckedChange={setVendorRegEnabled} />
            </div>
            {vendorRegEnabled && (
              <VendorPricingEditor packages={vendorPackages} onChange={setVendorPackages} />
            )}
          </div>
        )}

        {/* Registration Toggle */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Registration</p>
                <p className="text-xs text-muted-foreground mt-1">Turn off to close registration for this event</p>
              </div>
            </div>
            <Switch checked={registrationEnabled} onCheckedChange={setRegistrationEnabled} />
          </div>
          {!registrationEnabled && (
            <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-xs font-medium text-muted-foreground">Reason for closing registration</label>
              <select
                value={registrationClosedReason}
                onChange={e => setRegistrationClosedReason(e.target.value)}
                className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground"
              >
                <option value="">No reason specified</option>
                <option value="event_passed">Event date has passed</option>
                <option value="registration_full">Registration is full</option>
                <option value="organizer_closed">Closed by organizer</option>
              </select>
            </div>
          )}
        </div>

        {/* Registration Fields Control */}
        {registrationEnabled && !ticketOnlyMode && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Registration Fields</h3>
              <p className="text-xs text-muted-foreground mt-1">Choose which fields attendees must fill out during registration.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { key: "full_name" as const, label: "Full Name" },
                { key: "email" as const, label: "Email" },
                { key: "phone" as const, label: "Phone Number" },
                { key: "attendee_type" as const, label: "Attending As" },
              ].map(field => (
                <label key={field.key} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 p-3 cursor-pointer hover:border-primary/50 transition-colors">
                  <Checkbox
                    checked={registrationFieldsConfig[field.key]}
                    onCheckedChange={(checked) => setRegistrationFieldsConfig(prev => ({ ...prev, [field.key]: !!checked }))}
                  />
                  <span className="text-sm text-foreground">{field.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Ticket-Only Mode Toggle */}
        {registrationEnabled && ticketTiers.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Ticket-Only Sales Mode</p>
                <p className="text-xs text-muted-foreground mt-1">Skip registration form (name, email, phone). Attendees just select a ticket tier, pay, and receive their ticket.</p>
              </div>
            </div>
            <Switch checked={ticketOnlyMode} onCheckedChange={setTicketOnlyMode} />
          </div>
        )}

        {/* Waitlist Toggle */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Waitlist</p>
              <p className="text-xs text-muted-foreground mt-1">Allow attendees to join a waitlist when the event reaches capacity</p>
            </div>
          </div>
          <Switch checked={waitlistEnabled} onCheckedChange={setWaitlistEnabled} />
        </div>

        {/* Postponement */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-sm font-semibold text-foreground">Postpone Event</p>
              <p className="text-xs text-muted-foreground mt-1">Mark this event as postponed with optional new date/location</p>
            </div>
          </div>
          <Switch checked={isPostponed} onCheckedChange={setIsPostponed} />
        </div>
        {isPostponed && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-4 border-l-2 border-yellow-500/30">
            <div>
              <Label className="text-muted-foreground text-xs">New Date (optional)</Label>
              <Input type="date" value={postponedDate} onChange={e => setPostponedDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">New Location (optional)</Label>
              <Input placeholder="New venue or location" value={postponedLocation} onChange={e => setPostponedLocation(e.target.value)} />
            </div>
          </div>
        )}

        <Button type="submit" disabled={saving} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90 py-6 text-base">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </div>
  );
};

export default OrganizerEditEvent;
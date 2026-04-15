import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Loader2, CheckCircle, QrCode, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getRemainingSlotsByOrganizer, getPlanLabel } from "@/lib/registrationLimits";
import PlanLimitReachedDialog from "@/components/organizer/PlanLimitReachedDialog";

interface Props { userId: string; isPaid?: boolean; onRequirePlan?: () => void; onNavigateToSubscription?: () => void; }

const PAYMENT_STATUS_OPTIONS = [
  { value: "paid_at_door", label: "Paid at Door" },
  { value: "pending", label: "Pending" },
  { value: "complimentary", label: "Complimentary" },
  { value: "free_walkin", label: "Free Event Walk-in" },
];

const ATTENDEE_TYPES = [
  { value: "participant", label: "Participant" },
  { value: "vip", label: "VIP" },
  { value: "media", label: "Media" },
  { value: "vendor", label: "Vendor" },
  { value: "speaker", label: "Speaker" },
  { value: "other", label: "Other (Custom)" },
];

const OrganizerDoorRegistration = ({ userId, isPaid = true, onRequirePlan, onNavigateToSubscription }: Props) => {
  const [events, setEvents] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [eventMode, setEventMode] = useState<"existing" | "new">("new");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [newEventName, setNewEventName] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("paid_at_door");
  const [attendeeType, setAttendeeType] = useState("participant");
  const [customType, setCustomType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastRegistered, setLastRegistered] = useState<{ ticketId: string; fullName: string } | null>(null);
  const [qrLink, setQrLink] = useState("");
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [limitPlan, setLimitPlan] = useState("");
  const [qrEventMode, setQrEventMode] = useState<"existing" | "new">("existing");
  const [qrSelectedEvent, setQrSelectedEvent] = useState("");
  const [qrNewEventName, setQrNewEventName] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);
  const doorQrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase.from("events").select("id, title, slug").eq("organizer_id", userId).order("date", { ascending: false });
      if (data) setEvents(data);
    };
    fetchEvents();
  }, [userId]);

  const getOrCreateEvent = async (mode: "existing" | "new", eventId: string, eventName: string): Promise<{ id: string; slug: string; title: string } | null> => {
    if (mode === "existing" && eventId) {
      return events.find(e => e.id === eventId) || null;
    }
    if (mode === "new" && eventName.trim()) {
      const slug = eventName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();
      const { data: newEvent, error } = await supabase.from("events").insert([{
        title: eventName.trim(), slug, category: "General",
        date: new Date().toISOString().split("T")[0], time: "00:00",
        location: "Door Registration", organizer_id: userId, is_published: true,
        ticket_price: "Free", short_description: "Auto-created for door registration",
      }]).select("id, slug, title").single();
      if (error || !newEvent) throw new Error(error?.message || "Failed to create event");
      setEvents(prev => [newEvent, ...prev]);
      return newEvent;
    }
    return null;
  };

  const generateQRLink = async () => {
    if (!isPaid) { onRequirePlan?.(); return; }
    try {
      let event: { id: string; slug: string; title: string } | null = null;
      if (qrEventMode === "existing") {
        event = events.find(e => e.id === qrSelectedEvent) || null;
      } else {
        if (!qrNewEventName.trim()) { toast.error("Enter an event name"); return; }
        event = await getOrCreateEvent("new", "", qrNewEventName);
      }
      if (!event) { toast.error("Select or create an event first"); return; }
      const link = `${window.location.origin}/event/${event.slug}/quick-register`;
      setQrLink(link);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate QR");
    }
  };

  const downloadQR = (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    const svg = ref.current.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx!.fillStyle = "#ffffff";
      ctx!.fillRect(0, 0, canvas.width, canvas.height);
      ctx!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement("a");
      a.download = `${filename}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPaid) { onRequirePlan?.(); return; }
    if (eventMode === "existing" && !selectedEvent) { toast.error("Select an event"); return; }
    if (eventMode === "new" && !newEventName.trim()) { toast.error("Enter an event name"); return; }
    if (!fullName || !phone) { toast.error("Name and phone are required"); return; }

    setSubmitting(true);
    try {
      // Check global registration limit
      const { remaining, plan, limit } = await getRemainingSlotsByOrganizer(userId);
      if (remaining <= 0) {
        setLimitPlan(plan);
        setShowLimitDialog(true);
        setSubmitting(false);
        return;
      }

      const event = await getOrCreateEvent(eventMode, selectedEvent, newEventName);
      if (!event) throw new Error("Event not found or could not be created");
      const resolvedType = attendeeType === "other" && customType.trim() ? customType.trim() : attendeeType;

      const { data, error } = await supabase.from("registrations").insert({
        event_id: event.id, event_slug: event.slug, full_name: fullName,
        email: email || `walkin-${Date.now()}@door.local`, phone,
        payment_method: paymentStatus,
        status: paymentStatus === "pending" ? "pending" : "approved",
        source: "walk-in", attendee_type: resolvedType,
        checked_in: true, checked_in_at: new Date().toISOString(),
      } as any).select("ticket_id, full_name").single();

      if (error) throw error;
      setLastRegistered({ ticketId: data.ticket_id, fullName: data.full_name });
      toast.success(`${fullName} registered & checked in!`);

      // Send welcome email if real email provided (fire and forget)
      const registrantEmail = email && !email.endsWith("@door.local") ? email : null;
      if (registrantEmail) {
        supabase.functions.invoke("send-registration-email", {
          body: {
            eventTitle: event.title,
            fullName,
            email: registrantEmail,
            eventSlug: event.slug,
            attendeeType: resolvedType,
            tierName: null,
          },
        }).catch(err => console.error("Door reg welcome email failed:", err));
      }

      setFullName(""); setPhone(""); setEmail(""); setOrganization(""); setHeardFrom(""); setCustomType("");
    } catch (err: any) {
      toast.error(err.message || "Failed to register");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Walk-in Registration Form */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
          <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Door Registration
          </h3>
          <p className="text-sm text-muted-foreground">Register walk-in attendees at the door. No need to publish an event first.</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label>Event *</Label>
              <div className="flex gap-2 mb-2">
                <Button type="button" variant={eventMode === "new" ? "default" : "outline"} size="sm"
                  onClick={() => setEventMode("new")}
                  className={eventMode === "new" ? "bg-gradient-gold text-primary-foreground" : "border-border"}>
                  New Event
                </Button>
                <Button type="button" variant={eventMode === "existing" ? "default" : "outline"} size="sm"
                  onClick={() => setEventMode("existing")}
                  className={eventMode === "existing" ? "bg-gradient-gold text-primary-foreground" : "border-border"}>
                  Existing Event
                </Button>
              </div>
              {eventMode === "new" ? (
                <Input value={newEventName} onChange={e => setNewEventName(e.target.value)} placeholder="Enter event name..." className="border-border bg-secondary" />
              ) : (
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger className="border-border bg-secondary"><SelectValue placeholder="Select event" /></SelectTrigger>
                  <SelectContent>
                    {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Attendee name" className="border-border bg-secondary" required />
            </div>
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+251..." className="border-border bg-secondary" required />
            </div>
            <div className="space-y-2">
              <Label>Email (Optional)</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="border-border bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label>Attendee Type</Label>
              <Select value={attendeeType} onValueChange={setAttendeeType}>
                <SelectTrigger className="border-border bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ATTENDEE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {attendeeType === "other" && (
                <Input value={customType} onChange={e => setCustomType(e.target.value)} placeholder="Enter custom type..." className="border-border bg-secondary" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Organization/Company (Optional)</Label>
              <Input value={organization} onChange={e => setOrganization(e.target.value)} placeholder="Company name" className="border-border bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label>How did you hear about the event? (Optional)</Label>
              <Input value={heardFrom} onChange={e => setHeardFrom(e.target.value)} placeholder="Social media, friend, etc." className="border-border bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="border-border bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={submitting} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Register & Check In
            </Button>
          </form>

          {lastRegistered && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 text-center space-y-3">
              <CheckCircle className="mx-auto h-8 w-8 text-green-500" />
              <p className="text-sm font-semibold text-foreground">{lastRegistered.fullName}</p>
              <p className="text-xs text-muted-foreground">Ticket: <span className="font-mono text-primary">{lastRegistered.ticketId}</span></p>
              <div ref={doorQrRef} className="inline-block rounded-lg bg-white p-3">
                <QRCodeSVG value={lastRegistered.ticketId} size={140} bgColor="#ffffff" fgColor="#000000" level="H" />
              </div>
              <div>
                <Button size="sm" variant="outline" onClick={() => downloadQR(doorQrRef, `ticket-${lastRegistered.ticketId}`)} className="border-border text-xs">
                  <Download className="h-3 w-3 mr-1" /> Download QR
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* QR Code Generator */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
          <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" /> QR Self-Registration
          </h3>
          <p className="text-sm text-muted-foreground">Generate a QR code for attendees to self-register at the venue.</p>

          <div className="space-y-3">
            <div className="flex gap-2 mb-2">
              <Button type="button" variant={qrEventMode === "existing" ? "default" : "outline"} size="sm"
                onClick={() => setQrEventMode("existing")}
                className={qrEventMode === "existing" ? "bg-gradient-gold text-primary-foreground" : "border-border"}>
                Existing Event
              </Button>
              <Button type="button" variant={qrEventMode === "new" ? "default" : "outline"} size="sm"
                onClick={() => setQrEventMode("new")}
                className={qrEventMode === "new" ? "bg-gradient-gold text-primary-foreground" : "border-border"}>
                New Event
              </Button>
            </div>
            {qrEventMode === "existing" ? (
              <Select value={qrSelectedEvent} onValueChange={setQrSelectedEvent}>
                <SelectTrigger className="border-border bg-secondary"><SelectValue placeholder="Select event" /></SelectTrigger>
                <SelectContent>
                  {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={qrNewEventName} onChange={e => setQrNewEventName(e.target.value)} placeholder="Enter event name..." className="border-border bg-secondary" />
            )}
            <Button onClick={generateQRLink} variant="outline" className="w-full border-border hover:border-primary">
              <QrCode className="mr-2 h-4 w-4" /> Generate QR Code
            </Button>
          </div>

          {qrLink && (
            <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
              <div ref={qrRef} className="inline-block rounded-lg bg-white p-4">
                <QRCodeSVG value={qrLink} size={200} bgColor="#ffffff" fgColor="#000000" level="H" includeMargin />
              </div>
              <p className="text-xs text-muted-foreground break-all">{qrLink}</p>
              <div className="flex gap-2 justify-center">
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(qrLink); toast.success("Link copied!"); }} className="border-border text-xs">
                  Copy Link
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadQR(qrRef, "self-registration-qr")} className="border-border text-xs">
                  <Download className="h-3 w-3 mr-1" /> Download QR
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      <PlanLimitReachedDialog
        open={showLimitDialog}
        onOpenChange={setShowLimitDialog}
        plan={limitPlan}
        onNavigateToSubscription={() => onNavigateToSubscription?.()}
      />
    </div>
  );
};

export default OrganizerDoorRegistration;

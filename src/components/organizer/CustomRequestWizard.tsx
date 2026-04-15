import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  X, ChevronLeft, ChevronRight, Loader2, CheckCircle2,
  Calendar, MapPin, Users, Wrench, Clock, CreditCard, User, Send,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
}

const STEPS = [
  "Event Information",
  "Services Needed",
  "Staff & Duration",
  "Budget & Contact",
];

const ONSITE_SERVICES = [
  "QR Check-in staff",
  "Badge printing",
  "Registration desk management",
];
const TECH_SERVICES = [
  "Custom registration form",
  "Custom event page design",
  "API integration",
  "Website integration",
];
const MARKETING_SERVICES = [
  "Email invitation campaigns",
  "SMS reminders",
  "Event promotion support",
];
const DATA_SERVICES = [
  "Advanced event analytics report",
  "Attendee segmentation",
  "Post-event insights",
];

const STAFF_OPTIONS = ["1–2 staff", "3–5 staff", "6+ staff"];
const DURATION_OPTIONS = ["Half-day", "Full day", "Multiple days"];
const BUDGET_OPTIONS = ["Under 5,000 ETB", "5,000 – 10,000 ETB", "10,000 – 25,000 ETB", "25,000+ ETB"];
const URGENCY_OPTIONS = ["Within 3 days", "Within 1 week", "Within 2 weeks", "Flexible"];

const CustomRequestWizard = ({ open, onClose, userId }: Props) => {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Step 1
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [eventVenue, setEventVenue] = useState("");
  const [expectedAttendees, setExpectedAttendees] = useState("");

  // Step 2
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [otherRequest, setOtherRequest] = useState("");

  // Step 3
  const [staffCount, setStaffCount] = useState("");
  const [duration, setDuration] = useState("");

  // Step 4
  const [budget, setBudget] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactOrg, setContactOrg] = useState("");
  const [urgency, setUrgency] = useState("");

  if (!open) return null;

  const toggleService = (service: string) => {
    setSelectedServices(prev =>
      prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]
    );
  };

  const canProceed = () => {
    if (step === 0) return eventName.trim() && eventDate;
    if (step === 1) return selectedServices.length > 0 || otherRequest.trim();
    if (step === 2) return true;
    if (step === 3) return contactName.trim() && contactEmail.trim() && contactPhone.trim();
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        eventName, eventDate, eventLocation: `${eventCity}${eventVenue ? `, ${eventVenue}` : ""}`,
        expectedAttendees, services: selectedServices, otherRequest,
        staffCount, duration, budget, urgency,
        contact: { name: contactName, email: contactEmail, phone: contactPhone, organization: contactOrg },
      };

      const { error } = await supabase.from("admin_notifications").insert({
        title: `Custom Request: ${eventName}`,
        message: JSON.stringify(payload),
        type: "custom_request",
        target: "admin",
      });
      if (error) throw error;

      setDone(true);
    } catch {
      toast.error("Failed to submit request.");
    }
    setSubmitting(false);
  };

  const handleClose = () => {
    setStep(0); setDone(false);
    setEventName(""); setEventDate(""); setEventCity(""); setEventVenue(""); setExpectedAttendees("");
    setSelectedServices([]); setOtherRequest("");
    setStaffCount(""); setDuration("");
    setBudget(""); setContactName(""); setContactEmail(""); setContactPhone(""); setContactOrg(""); setUrgency("");
    onClose();
  };

  const renderServiceGroup = (title: string, items: string[]) => (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map(item => (
          <label key={item} className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-all text-xs ${
            selectedServices.includes(item) ? "border-primary bg-primary/5" : "border-border bg-secondary hover:border-primary/30"
          }`}>
            <Checkbox checked={selectedServices.includes(item)} onCheckedChange={() => toggleService(item)} />
            <span className="text-muted-foreground">{item}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const renderRadioGroup = (options: string[], value: string, onChange: (v: string) => void) => (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)}
          className={`rounded-lg border p-3 text-xs text-left transition-all ${
            value === opt ? "border-primary bg-primary/5 text-foreground font-medium" : "border-border bg-secondary text-muted-foreground hover:border-primary/30"
          }`}>
          {opt}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={handleClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 space-y-5" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Custom Request</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Need something more advanced? Our team can support your event with custom solutions.
            </p>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {!done && (
          <>
            {/* Progress */}
            <div className="flex items-center gap-1">
              {STEPS.map((s, i) => (
                <div key={i} className="flex-1 flex items-center gap-1">
                  <div className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-border"}`} />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}: <span className="text-foreground font-medium">{STEPS[step]}</span></p>
          </>
        )}

        {/* Step 1: Event Information */}
        {!done && step === 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-semibold">Event Information</span>
            </div>
            <p className="text-xs text-muted-foreground">This helps us understand your event size and logistics.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Event Name *</Label>
                <Input value={eventName} onChange={e => setEventName(e.target.value)} placeholder="e.g. Tech Summit 2026" className="border-border bg-secondary text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Event Date *</Label>
                <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="border-border bg-secondary text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <Input value={eventCity} onChange={e => setEventCity(e.target.value)} placeholder="e.g. Addis Ababa" className="border-border bg-secondary text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Venue</Label>
                <Input value={eventVenue} onChange={e => setEventVenue(e.target.value)} placeholder="e.g. Millennium Hall" className="border-border bg-secondary text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expected Number of Attendees</Label>
              <Input type="number" value={expectedAttendees} onChange={e => setExpectedAttendees(e.target.value)} placeholder="e.g. 500" className="border-border bg-secondary text-sm max-w-xs" />
            </div>
          </div>
        )}

        {/* Step 2: Services */}
        {!done && step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Wrench className="h-4 w-4" />
              <span className="text-sm font-semibold">Type of Additional Services Needed</span>
            </div>
            <p className="text-xs text-muted-foreground">Select all services that apply to your event.</p>
            {renderServiceGroup("On-site Services", ONSITE_SERVICES)}
            {renderServiceGroup("Technical Services", TECH_SERVICES)}
            {renderServiceGroup("Marketing & Communication", MARKETING_SERVICES)}
            {renderServiceGroup("Data & Analytics", DATA_SERVICES)}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">Other</p>
              <Textarea value={otherRequest} onChange={e => setOtherRequest(e.target.value)}
                placeholder="Describe any other request or need..."
                className="border-border bg-secondary text-sm min-h-[60px]" />
            </div>
          </div>
        )}

        {/* Step 3: Staff & Duration */}
        {!done && step === 2 && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 text-primary mb-2">
                <Users className="h-4 w-4" />
                <span className="text-sm font-semibold">Number of Staff Required</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">If you need on-site support, how many staff members?</p>
              {renderRadioGroup(STAFF_OPTIONS, staffCount, setStaffCount)}
            </div>
            <div>
              <div className="flex items-center gap-2 text-primary mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-semibold">Event Duration</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">This helps us price on-site services.</p>
              {renderRadioGroup(DURATION_OPTIONS, duration, setDuration)}
            </div>
          </div>
        )}

        {/* Step 4: Budget, Contact & Urgency */}
        {!done && step === 3 && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 text-primary mb-2">
                <CreditCard className="h-4 w-4" />
                <span className="text-sm font-semibold">Budget Range (Optional)</span>
              </div>
              {renderRadioGroup(BUDGET_OPTIONS, budget, setBudget)}
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 text-primary mb-3">
                <User className="h-4 w-4" />
                <span className="text-sm font-semibold">Contact Details</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Name *</Label>
                  <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Your full name" className="border-border bg-secondary text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email *</Label>
                  <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="email@example.com" className="border-border bg-secondary text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone *</Label>
                  <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+251..." className="border-border bg-secondary text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Organization (Optional)</Label>
                  <Input value={contactOrg} onChange={e => setContactOrg(e.target.value)} placeholder="Your company or org" className="border-border bg-secondary text-sm" />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 text-primary mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-semibold">Deadline / Urgency</span>
              </div>
              {renderRadioGroup(URGENCY_OPTIONS, urgency, setUrgency)}
            </div>
          </div>
        )}

        {/* Done */}
        {done && (
          <div className="text-center space-y-4 py-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-display text-lg font-bold text-foreground">Request Submitted!</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Our team will review your request and reach out with a custom quote. Thank you for choosing our premium services.
            </p>
            <Button onClick={handleClose} className="bg-gradient-gold text-primary-foreground">Got It</Button>
          </div>
        )}

        {/* Navigation */}
        {!done && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <Button variant="outline" onClick={() => step === 0 ? handleClose() : setStep(step - 1)} className="border-border">
              <ChevronLeft className="h-4 w-4 mr-1" /> {step === 0 ? "Cancel" : "Back"}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="bg-gradient-gold text-primary-foreground">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting || !canProceed()} className="bg-gradient-gold text-primary-foreground">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Submit Request
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomRequestWizard;

import { Info, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_DESCRIPTIONS: Record<string, string> = {
  overview: "Get a bird's-eye view of your event performance — total registrations, approvals, pending payments, and revenue at a glance.",
  events: "Create, manage, and publish your events. Set up registration forms, pricing, and custom questions all in one place.",
  "create-event": "Set up your event with all the details — name, date, location, ticket pricing, payment methods, and custom registration questions.",
  "edit-event": "Edit your event details, update pricing, change the poster, and manage custom registration questions.",
  registrations: "View and manage all attendee registrations. Approve or reject payments, filter by event, and export attendee data.",
  payments: "Review attendee payment submissions. Approve or reject receipts and track payment status for your events.",
  checkin: "Scan QR codes or enter ticket IDs to check in attendees at your event. Track real-time check-in progress.",
  import: "Import attendee lists from Excel or CSV files. Auto-generate unique ticket IDs and QR codes for every imported attendee.",
  "door-registration": "Register walk-in attendees at the door and generate QR codes so attendees can self-register at the venue.",
  surveys: "Create post-event surveys to gather attendee feedback. Distribute via QR code or email after your event.",
  analytics: "Track your event performance with registration trends, attendance rates, revenue breakdowns, and audience insights.",
  sharing: "Share your event registration links on WhatsApp, Telegram, and other platforms to boost sign-ups.",
  settings: "Manage your profile information, default payment methods, and account security settings.",
  notifications: "Stay updated with the latest registration activity, check-ins, and payment updates for your events.",
  "attendee-intelligence": "Build attendee profiles across all your events. Track returning attendees, segment your audience, and create targeted invite lists.",
};

interface Props {
  section: string;
  visible: boolean;
  onRequirePlan?: () => void;
}

const PageGuide = ({ section, visible, onRequirePlan }: Props) => {
  if (!visible) return null;
  const desc = PAGE_DESCRIPTIONS[section];
  if (!desc) return null;
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3 mb-4">
      <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{desc}</p>
        <div className="flex items-center gap-3 mt-2">
          <p className="text-xs text-primary/70 font-medium">You're exploring — subscribe to a plan to unlock this feature.</p>
          <Button size="sm" onClick={onRequirePlan} className="h-7 px-3 text-xs bg-gradient-gold text-primary-foreground hover:opacity-90 gap-1">
            <Sparkles className="h-3 w-3" /> Subscribe
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PageGuide;

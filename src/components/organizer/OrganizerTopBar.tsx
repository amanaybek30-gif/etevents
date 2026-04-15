import { Bell, Search, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { OrganizerSection } from "./OrganizerSidebar";

const SECTION_TITLES: Record<OrganizerSection, string> = {
  overview: "Dashboard",
  events: "My Events",
  "create-event": "Create Event",
  "edit-event": "Edit Event",
  registrations: "Registrations",
  payments: "Payment Verification",
  checkin: "Check-in Station",
  import: "Import Attendees",
  "door-registration": "Door Registration",
  surveys: "Surveys & Feedback",
  analytics: "Analytics",
  "attendee-intelligence": "Attendee Intelligence (CRM)",
  sharing: "Share & Promote",
  subscription: "Subscription",
  vendors: "Vendor Applications",
  profile: "Public Profile",
  settings: "Settings",
  notifications: "Notifications",
  waitlist: "Waitlist Management",
  discussions: "Event Discussions",
  promotion: "Promote Events",
  "staff-checkin": "Staff Check-in Dashboard",
};

const BACK_TARGET: Partial<Record<OrganizerSection, OrganizerSection>> = {
  "create-event": "events",
  "edit-event": "events",
  registrations: "overview",
  payments: "overview",
  checkin: "overview",
  import: "overview",
  "door-registration": "overview",
  analytics: "overview",
  "attendee-intelligence": "overview",
  sharing: "overview",
  settings: "overview",
  notifications: "overview",
  events: "overview",
};

interface Props {
  section: OrganizerSection;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNotifications: () => void;
  onNavigate: (section: OrganizerSection) => void;
}

const OrganizerTopBar = ({ section, searchQuery, onSearchChange, onNotifications, onNavigate }: Props) => {
  const backTarget = BACK_TARGET[section];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/80 backdrop-blur-xl px-3 lg:px-6">
      <div className="flex items-center gap-2 pl-10 lg:pl-0 min-w-0">
        {backTarget && (
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => onNavigate(backTarget)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h1 className="font-display text-sm sm:text-base font-bold text-foreground truncate">{SECTION_TITLES[section]}</h1>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 w-48 border-border bg-secondary pl-8 text-sm"
          />
        </div>
        <Button variant="ghost" size="icon" className="relative" onClick={onNotifications}>
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
};

export default OrganizerTopBar;

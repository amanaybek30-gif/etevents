import { 
  LayoutDashboard, Calendar, Users, CreditCard, Ticket, BarChart3, 
  Share2, Settings, Bell, LogOut, Menu, X, Home, FileSpreadsheet, ScanLine, UserPlus, ClipboardList, Brain, Store, User,
  Clock, MessageCircle, Megaphone, UsersRound, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

export type OrganizerSection = 
  | "overview" | "events" | "create-event" | "edit-event" | "registrations" | "payments" 
  | "checkin" | "import" | "door-registration" | "surveys" | "analytics" | "sharing" | "settings" | "notifications"
  | "attendee-intelligence" | "subscription" | "vendors" | "profile"
  | "waitlist" | "discussions" | "promotion" | "staff-checkin";

const NAV_ITEMS: { id: OrganizerSection; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "events", label: "My Events", icon: Calendar },
  { id: "registrations", label: "Registrations", icon: Users },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "checkin", label: "Check-in", icon: ScanLine },
  { id: "staff-checkin", label: "Staff Check-ins", icon: UsersRound },
  { id: "door-registration", label: "Door Registration", icon: UserPlus },
  { id: "waitlist", label: "Waitlist", icon: Clock },
  { id: "import", label: "Import Attendees", icon: FileSpreadsheet },
  { id: "vendors", label: "Vendor Apps", icon: Store },
  { id: "surveys", label: "Surveys", icon: ClipboardList },
  { id: "discussions", label: "Discussions", icon: MessageCircle },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "attendee-intelligence", label: "Attendee CRM", icon: Brain },
  { id: "promotion", label: "Promote Events", icon: Megaphone },
  { id: "sharing", label: "Share Links", icon: Share2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "subscription", label: "Subscription", icon: CreditCard },
  
  { id: "profile", label: "Public Profile", icon: User },
  { id: "settings", label: "Settings", icon: Settings },
];

// Minimum plan required to access each section
const PLAN_REQUIREMENTS: Partial<Record<OrganizerSection, string>> = {
  "staff-checkin": "pro",
  "surveys": "pro",
  "attendee-intelligence": "corporate",
};

interface Props {
  active: OrganizerSection;
  onNavigate: (section: OrganizerSection) => void;
  open: boolean;
  onToggle: () => void;
  isExplorer?: boolean;
  onSignOut: () => void;
  userPlan?: string;
  subscriptionEnabled?: boolean;
}

const OrganizerSidebar = ({ active, onNavigate, open, onToggle, onSignOut, userPlan = "free", subscriptionEnabled = false, isExplorer = false }: Props) => {
  const { flags } = useFeatureFlags();

  const FEATURE_FLAG_MAP: Partial<Record<OrganizerSection, string>> = {
    profile: "feature_organizer_profiles",
    vendors: "feature_vendor_registration",
    sharing: "feature_share_events",
  };

  const PLAN_ORDER = ["free", "organizer", "pro", "corporate"];
  const currentPlanIndex = PLAN_ORDER.indexOf(userPlan);

  const filteredItems = NAV_ITEMS.filter(item => {
    const flag = FEATURE_FLAG_MAP[item.id];
    return !flag || flags[flag] !== false;
  });

  const isLocked = (section: OrganizerSection) => {
    if (!subscriptionEnabled) return false;
    const requiredPlan = PLAN_REQUIREMENTS[section];
    if (!requiredPlan) return false;
    const requiredIndex = PLAN_ORDER.indexOf(requiredPlan);
    return currentPlanIndex < requiredIndex;
  };

  return (
    <>
      <Button variant="ghost" size="icon" className="fixed left-3 top-3 z-50 lg:hidden" onClick={onToggle}>
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>
      {open && <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden" onClick={onToggle} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Ticket className="h-5 w-5 text-primary" />
          <span className="font-display text-base font-bold text-foreground">Organizer Panel</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {filteredItems.map(item => {
            const locked = isLocked(item.id);
            return (
              <button key={item.id} onClick={() => { onNavigate(item.id); onToggle(); }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active === item.id ? "bg-primary/10 text-primary" 
                    : locked ? "text-muted-foreground/50 hover:bg-secondary" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}>
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {locked && <Lock className="h-3 w-3 shrink-0 text-muted-foreground/40" />}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-border p-3 space-y-1">
          <Button variant="ghost" size="sm" asChild className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground">
            <Link to={isExplorer ? "/my-account" : "/"}><Home className="h-4 w-4" /> {isExplorer ? "Back to Explorer" : "Home"}</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={onSignOut} className="w-full justify-start gap-3 text-destructive hover:text-destructive/80">
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>
      </aside>
    </>
  );
};

export default OrganizerSidebar;

import {
  LayoutDashboard, Calendar, Users, CreditCard, Ticket, AlertTriangle,
  BarChart3, Bell, Settings, FileText, LogOut, Home, Wrench, ToggleLeft,
  Menu, X, Megaphone, BadgeDollarSign, Mail, Quote, MessageCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type AdminSection =
  | "dashboard" | "events" | "users" | "transactions"
  | "registrations" | "disputes" | "analytics"
  | "notifications" | "settings" | "logs" | "subscriptions" | "custom-requests" | "feature-controls"
  | "announcements" | "advertisements" | "marketing" | "testimonials" | "telegram";

const navItems: { id: AdminSection; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "events", label: "Events", icon: Calendar },
  { id: "users", label: "Users", icon: Users },
  { id: "transactions", label: "Transactions", icon: CreditCard },
  { id: "registrations", label: "Registrations", icon: Ticket },
  { id: "disputes", label: "Disputes", icon: AlertTriangle },
  { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { id: "custom-requests", label: "Custom Requests", icon: Wrench },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "advertisements", label: "Advertisements", icon: BadgeDollarSign },
  { id: "marketing", label: "Marketing", icon: Mail },
  { id: "testimonials", label: "Testimonials", icon: Quote },
  { id: "telegram", label: "Telegram", icon: MessageCircle },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "feature-controls", label: "Feature Controls", icon: ToggleLeft },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "logs", label: "Logs", icon: FileText },
];

interface AdminSidebarProps {
  active: AdminSection;
  onNavigate: (section: AdminSection) => void;
  onSignOut: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileToggle: () => void;
  unreadNotifications?: number;
  pendingDisputes?: number;
}

const AdminSidebar = ({ active, onNavigate, onSignOut, collapsed, onToggleCollapse, mobileOpen, onMobileToggle, unreadNotifications = 0, pendingDisputes = 0 }: AdminSidebarProps) => {
  return (
    <>
      {/* Mobile hamburger */}
      <Button variant="ghost" size="icon" className="fixed left-3 top-3 z-50 lg:hidden" onClick={onMobileToggle}>
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden" onClick={onMobileToggle} />}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-card transition-all duration-300",
        // Mobile: slide in/out
        "lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop: collapse
        collapsed ? "w-16" : "w-60"
      )}>
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <LayoutDashboard className="h-6 w-6 text-primary shrink-0" />
          {!collapsed && <span className="font-display text-lg font-bold text-foreground">Admin</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
          {navItems.map((item) => {
            const badge =
              item.id === "notifications" ? unreadNotifications :
              item.id === "disputes" ? pendingDisputes : 0;
            return (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); onMobileToggle(); }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors relative",
                  active === item.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
                {badge > 0 && (
                  <span className={cn(
                    "flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold",
                    collapsed ? "absolute -right-0.5 -top-0.5 h-4 w-4" : "ml-auto h-5 min-w-5 px-1"
                  )}>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-2 space-y-1">
          <Link
            to="/"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Home</span>}
          </Link>
          <button
            onClick={onSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;

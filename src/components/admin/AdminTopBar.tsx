import { Bell, Menu, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import type { AdminSection } from "./AdminSidebar";

interface AdminTopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onToggleSidebar: () => void;
  unreadNotifications: number;
  onNavigate: (section: AdminSection) => void;
}

const AdminTopBar = ({ searchQuery, onSearchChange, onToggleSidebar, unreadNotifications, onNavigate }: AdminTopBarProps) => {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/80 backdrop-blur-xl px-3 lg:px-4">
      <Button variant="ghost" size="sm" onClick={onToggleSidebar} className="h-8 w-8 p-0 shrink-0 hidden lg:flex">
        <Menu className="h-4 w-4" />
      </Button>
      {/* Spacer for mobile hamburger */}
      <div className="w-10 shrink-0 lg:hidden" />
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="border-border bg-secondary pl-10 h-9 text-sm"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0" onClick={() => onNavigate("notifications")}>
          <Bell className="h-4 w-4" />
          {unreadNotifications > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold">
              {unreadNotifications}
            </span>
          )}
        </Button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
          A
        </div>
      </div>
    </header>
  );
};

export default AdminTopBar;

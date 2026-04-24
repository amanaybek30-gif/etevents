import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import versLogo from "@/assets/vers-logo-nobg.png";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<"admin" | "organizer" | "attendee" | null>(null);

  useEffect(() => {
    const checkRole = async (userId: string) => {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (roles?.some(r => r.role === "admin")) {
        setUserRole("admin");
      } else if (roles?.some(r => r.role === "organizer")) {
        setUserRole("organizer");
      } else {
        const { data: orgProfile } = await supabase.from("organizer_profiles").select("id").eq("user_id", userId).maybeSingle();
        setUserRole(orgProfile ? "organizer" : "attendee");
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      if (session) checkRole(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session);
      if (session) checkRole(session.user.id);
      else setUserRole(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const dashboardPath = userRole === "admin" ? "/admin" : userRole === "organizer" ? "/organizer" : "/my-account";
  const dashboardLabel = userRole === "admin" ? "Admin" : userRole === "organizer" ? "Dashboard" : "My Account";

  return (
    <nav
      data-mobile-floating="true"
      className="fixed inset-x-0 top-0 z-50 border-transparent bg-transparent shadow-none backdrop-blur-0 md:border-b md:border-border/50 md:bg-background/80 md:backdrop-blur-xl"
    >
      <div className="container mx-auto flex h-11 items-center justify-between px-3 md:h-16 md:px-4">
        <Link to="/" className="flex min-w-0 items-center gap-1.5">
          <img src={versLogo} alt="VERS" className="h-8 w-8 object-contain md:h-11 md:w-11" />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-6 md:flex">
          <Link to="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Home</Link>
          <Link to="/events" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Events</Link>
          <Link to="/about" className="text-sm text-muted-foreground transition-colors hover:text-foreground">About</Link>
          {isLoggedIn ? (
            <Link to={dashboardPath} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{dashboardLabel}</Link>
          ) : (
            <Link to="/auth?intent=organizer" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Create Event</Link>
          )}
          <Button asChild className="bg-gradient-gold text-primary-foreground hover:opacity-90">
            <Link to={isLoggedIn ? dashboardPath : "/auth"}>{isLoggedIn ? dashboardLabel : "Sign In"}</Link>
          </Button>
        </div>

        {/* Mobile Toggle */}
        <div className="flex items-center gap-1.5 md:hidden">
          <button
            type="button"
            aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary/40"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="bg-transparent px-3 pb-3 md:hidden">
          <div className="container mx-auto rounded-2xl border border-border/40 bg-background/95 px-3 py-3 shadow-gold backdrop-blur-xl">
            <div className="flex flex-col gap-2.5">
              <Link to="/" onClick={() => setIsOpen(false)} className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">Home</Link>
              <Link to="/events" onClick={() => setIsOpen(false)} className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">Events</Link>
              <Link to="/about" onClick={() => setIsOpen(false)} className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">About</Link>
              {isLoggedIn ? (
                <Link to={dashboardPath} onClick={() => setIsOpen(false)} className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                  {dashboardLabel}
                </Link>
              ) : (
                <Link to="/auth?intent=organizer" onClick={() => setIsOpen(false)} className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                  Create Event
                </Link>
              )}
              <Button asChild size="sm" className="h-7 bg-gradient-gold text-[11px] text-primary-foreground">
                <Link to={isLoggedIn ? dashboardPath : "/auth"} onClick={() => setIsOpen(false)}>
                  {isLoggedIn ? dashboardLabel : "Sign In"}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

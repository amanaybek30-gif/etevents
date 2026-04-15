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
    <nav className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <img src={versLogo} alt="VERS" className="h-11 w-11 object-contain" />
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
        <div className="flex items-center gap-2 md:hidden">
          <button className="text-foreground" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="border-t border-border bg-background/95 backdrop-blur-xl md:hidden">
          <div className="container mx-auto flex flex-col gap-4 px-4 py-6">
            <Link to="/" onClick={() => setIsOpen(false)} className="text-sm text-muted-foreground">Home</Link>
            <Link to="/events" onClick={() => setIsOpen(false)} className="text-sm text-muted-foreground">Events</Link>
            <Link to="/about" onClick={() => setIsOpen(false)} className="text-sm text-muted-foreground">About</Link>
            {isLoggedIn ? (
              <Link to={dashboardPath} onClick={() => setIsOpen(false)} className="text-sm text-muted-foreground">
                {dashboardLabel}
              </Link>
            ) : (
              <Link to="/auth?intent=organizer" onClick={() => setIsOpen(false)} className="text-sm text-muted-foreground">
                Create Event
              </Link>
            )}
            <Button asChild className="bg-gradient-gold text-primary-foreground">
              <Link to={isLoggedIn ? dashboardPath : "/auth"} onClick={() => setIsOpen(false)}>
                {isLoggedIn ? dashboardLabel : "Sign In"}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

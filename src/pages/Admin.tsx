import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import AdminSidebar, { type AdminSection } from "@/components/admin/AdminSidebar";
import AdminTopBar from "@/components/admin/AdminTopBar";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminEvents from "@/components/admin/AdminEvents";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminTransactions from "@/components/admin/AdminTransactions";
import AdminRegistrations from "@/components/admin/AdminRegistrations";
import AdminDisputes from "@/components/admin/AdminDisputes";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import AdminNotifications from "@/components/admin/AdminNotifications";
import AdminSettings from "@/components/admin/AdminSettings";
import AdminLogs from "@/components/admin/AdminLogs";
import AdminSubscriptions from "@/components/admin/AdminSubscriptions";
import AdminCustomRequests from "@/components/admin/AdminCustomRequests";
import AdminFeatureControls from "@/components/admin/AdminFeatureControls";
import AdminAnnouncements from "@/components/admin/AdminAnnouncements";
import AdminAdvertisements from "@/components/admin/AdminAdvertisements";
import AdminMarketing from "@/components/admin/AdminMarketing";
import AdminTestimonials from "@/components/admin/AdminTestimonials";
import AdminTelegram from "@/components/admin/AdminTelegram";
import { cn } from "@/lib/utils";
import SEO from "@/components/SEO";

const Admin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingDisputes, setPendingDisputes] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      const isAdmin = roles?.some(r => r.role === "admin");
      if (!isAdmin) { toast.error("Admin access only"); navigate("/"); return; }
      setUserId(session.user.id);
      setLoading(false);
    };
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!loading) fetchBadges();
  }, [loading]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTo?.(0, 0);
    document.body.scrollTo?.(0, 0);
  }, [activeSection]);

  const fetchBadges = async () => {
    const [notifRes, disputeRes] = await Promise.all([
      supabase.from("admin_notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
      supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]);
    setUnreadNotifications(notifRes.count ?? 0);
    setPendingDisputes(disputeRes.count ?? 0);
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/"); };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const renderSection = () => {
    switch (activeSection) {
      case "dashboard": return <AdminDashboard onNavigate={setActiveSection} />;
      case "events": return <AdminEvents searchQuery={searchQuery} />;
      case "users": return <AdminUsers searchQuery={searchQuery} />;
      case "transactions": return <AdminTransactions searchQuery={searchQuery} adminId={userId} />;
      case "registrations": return <AdminRegistrations searchQuery={searchQuery} adminId={userId} />;
      case "disputes": return <AdminDisputes searchQuery={searchQuery} adminId={userId} />;
      case "analytics": return <AdminAnalytics />;
      case "notifications": return <AdminNotifications adminId={userId} />;
      case "settings": return <AdminSettings adminId={userId} />;
      case "subscriptions": return <AdminSubscriptions searchQuery={searchQuery} adminId={userId} />;
      case "logs": return <AdminLogs searchQuery={searchQuery} />;
      case "custom-requests": return <AdminCustomRequests searchQuery={searchQuery} adminId={userId} />;
      case "feature-controls": return <AdminFeatureControls adminId={userId} />;
      case "announcements": return <AdminAnnouncements adminId={userId} />;
      case "advertisements": return <AdminAdvertisements adminId={userId} />;
      case "marketing": return <AdminMarketing adminId={userId} />;
      case "testimonials": return <AdminTestimonials adminId={userId} />;
      case "telegram": return <AdminTelegram adminId={userId} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Admin Dashboard" description="VERS platform administration panel" path="/admin" noindex />
      <AdminSidebar
        active={activeSection}
        onNavigate={setActiveSection}
        onSignOut={handleSignOut}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileOpen}
        onMobileToggle={() => setMobileOpen(!mobileOpen)}
        unreadNotifications={unreadNotifications}
        pendingDisputes={pendingDisputes}
      />
      <div className={cn(
        "transition-all duration-300",
        // Desktop: offset by sidebar width
        "lg:ml-60",
        sidebarCollapsed && "lg:ml-16",
        // Mobile: no offset
      )}>
        <AdminTopBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onToggleSidebar={() => {
            // Desktop: collapse sidebar, Mobile: open sidebar
            if (window.innerWidth >= 1024) {
              setSidebarCollapsed(!sidebarCollapsed);
            } else {
              setMobileOpen(!mobileOpen);
            }
          }}
          unreadNotifications={unreadNotifications}
          onNavigate={setActiveSection}
        />
        <main className="p-3 sm:p-4 md:p-6">
          {renderSection()}
        </main>
      </div>
    </div>
  );
};

export default Admin;

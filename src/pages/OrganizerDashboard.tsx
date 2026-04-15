import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import OrganizerSidebar, { type OrganizerSection } from "@/components/organizer/OrganizerSidebar";
import OrganizerTopBar from "@/components/organizer/OrganizerTopBar";
import OrganizerOverview from "@/components/organizer/OrganizerOverview";
import OrganizerEvents from "@/components/organizer/OrganizerEvents";
import OrganizerCreateEvent from "@/components/organizer/OrganizerCreateEvent";
import OrganizerEditEvent from "@/components/organizer/OrganizerEditEvent";
import OrganizerRegistrations from "@/components/organizer/OrganizerRegistrations";
import OrganizerPayments from "@/components/organizer/OrganizerPayments";
import OrganizerCheckin from "@/components/organizer/OrganizerCheckin";
import OrganizerImport from "@/components/organizer/OrganizerImport";
import OrganizerDoorRegistration from "@/components/organizer/OrganizerDoorRegistration";
import OrganizerAnalytics from "@/components/organizer/OrganizerAnalytics";
import OrganizerSurveys from "@/components/organizer/OrganizerSurveys";
import OrganizerSharing from "@/components/organizer/OrganizerSharing";
import OrganizerSettings from "@/components/organizer/OrganizerSettings";
import OrganizerSubscription from "@/components/organizer/OrganizerSubscription";
import OrganizerNotifications from "@/components/organizer/OrganizerNotifications";
import AttendeeIntelligence from "@/components/organizer/AttendeeIntelligence";
import OrganizerVendors from "@/components/organizer/OrganizerVendors";
import OrganizerProfileEdit from "@/components/organizer/OrganizerProfileEdit";
import OrganizerWaitlist from "@/components/organizer/OrganizerWaitlist";
import OrganizerDiscussions from "@/components/organizer/OrganizerDiscussions";
import OrganizerPromotion from "@/components/organizer/OrganizerPromotion";
import StaffCheckinDashboard from "@/components/organizer/StaffCheckinDashboard";

import SubscriptionGate from "@/components/organizer/SubscriptionGate";
import PageGuide from "@/components/organizer/PageGuide";
import PlanPromptDialog from "@/components/organizer/PlanPromptDialog";
import WelcomeSubscriptionDialog from "@/components/organizer/WelcomeSubscriptionDialog";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { toast } from "sonner";
import SEO from "@/components/SEO";

const OrganizerDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [section, setSection] = useState<OrganizerSection>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState("free");
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
  const [isPaid, setIsPaid] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isExplorer, setIsExplorer] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      if (roles?.some(r => r.role === "admin")) { navigate("/admin"); return; }

      // Allow both organizer and attendee (explorer) roles — explorers can access if they have an organizer_profile
      const isOrganizer = roles?.some(r => r.role === "organizer");
      const isAttendee = roles?.some(r => r.role === "attendee");

      const { data: prof } = await supabase.from("organizer_profiles")
        .select("subscription_plan, subscription_paid, subscription_expires_at")
        .eq("user_id", session.user.id).single();

      // If no organizer profile exists and user isn't an organizer, redirect
      if (!prof && !isOrganizer) { navigate("/my-account"); return; }

      // Track if user is an explorer (attendee without organizer role, or unpaid)
      setIsExplorer(isAttendee && !isOrganizer);

      setUserId(session.user.id);
      if (prof) setUserPlan(prof.subscription_plan || "free");

      // Auto-promote explorer to organizer after 3 events
      if (isAttendee && !isOrganizer) {
        const { count } = await supabase.from("events")
          .select("id", { count: "exact", head: true })
          .eq("organizer_id", session.user.id);
        if (count && count >= 3) {
          await supabase.from("user_roles").insert({
            user_id: session.user.id,
            role: "organizer",
          } as any);
          toast.success("You've been promoted to Organizer! 🎉");
        }
      }

      const { data: settings } = await supabase.from("platform_settings").select("key, value").eq("key", "subscription_enabled");
      const subEnabled = settings?.some(s => s.value === "true") || false;
      setSubscriptionEnabled(subEnabled);

      if (!subEnabled) {
        setIsPaid(true);
      } else if (prof?.subscription_paid && prof?.subscription_expires_at) {
        const paid = new Date(prof.subscription_expires_at) > new Date();
        setIsPaid(paid);
        if (paid) {
          const welcomeKey = `welcome_shown_${session.user.id}`;
          if (!localStorage.getItem(welcomeKey)) {
            setShowWelcome(true);
            localStorage.setItem(welcomeKey, "true");
          }
        }
      } else {
        setIsPaid(false);
      }

      setLoading(false);
    };
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTo?.(0, 0);
    document.body.scrollTo?.(0, 0);
  }, [section]);

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/"); };
  const handleEditEvent = (eventId: string) => { setEditEventId(eventId); setSection("edit-event"); };
  const handleRequirePlan = () => setShowPlanModal(true);

  // Plan modal is now self-contained — no handler needed

  const { flags } = useFeatureFlags();

  const SECTION_FLAG_MAP: Partial<Record<OrganizerSection, string>> = {
    profile: "feature_organizer_profiles",
    vendors: "feature_vendor_registration",
    sharing: "feature_share_events",
  };

  const handleNavigate = (sec: OrganizerSection) => {
    // Block navigation to disabled features
    const flag = SECTION_FLAG_MAP[sec];
    if (flag && flags[flag] === false) {
      toast.error("This feature is currently disabled by the platform.");
      return;
    }

    if (subscriptionEnabled && isPaid) {
      if (sec === "attendee-intelligence" && userPlan !== "corporate") {
        toast.error("Attendee Intelligence (CRM) is only available on the Corporate plan.");
        return;
      }
      if (sec === "surveys" && userPlan !== "pro" && userPlan !== "corporate") {
        toast.error("Survey forms require at least the Pro Organizer plan.");
        return;
      }
      if (sec === "analytics" && userPlan !== "organizer" && userPlan !== "pro" && userPlan !== "corporate") {
        toast.error("Analytics require a paid subscription plan.");
        return;
      }
      if (sec === "staff-checkin" && userPlan !== "pro" && userPlan !== "corporate") {
        toast.error("Multi-Staff Check-In requires at least the Pro Organizer plan.");
        return;
      }
    }
    setSection(sec);
  };

  if (loading || !userId) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const renderSection = () => {
    switch (section) {
      case "overview": return <OrganizerOverview userId={userId} onNavigate={handleNavigate} />;
      case "events": return <OrganizerEvents userId={userId} onNavigate={handleNavigate} onEditEvent={handleEditEvent} isPaid={isPaid} onRequirePlan={handleRequirePlan} />;
      case "create-event": return <OrganizerCreateEvent userId={userId} onNavigate={handleNavigate} isPaid={isPaid} onRequirePlan={handleRequirePlan} />;
      case "edit-event": return editEventId ? <OrganizerEditEvent userId={userId} eventId={editEventId} onNavigate={handleNavigate} /> : <OrganizerEvents userId={userId} onNavigate={handleNavigate} onEditEvent={handleEditEvent} isPaid={isPaid} onRequirePlan={handleRequirePlan} />;
      case "registrations": return <OrganizerRegistrations userId={userId} searchQuery={searchQuery} userPlan={userPlan} subscriptionEnabled={subscriptionEnabled} isPaid={isPaid} onRequirePlan={handleRequirePlan} />;
      case "payments": return <OrganizerPayments userId={userId} isPaid={isPaid} onRequirePlan={handleRequirePlan} />;
      case "checkin": return <OrganizerCheckin userId={userId} isPaid={isPaid} onRequirePlan={handleRequirePlan} userPlan={userPlan} subscriptionEnabled={subscriptionEnabled} />;
      case "import": return <OrganizerImport userId={userId} isPaid={isPaid} onRequirePlan={handleRequirePlan} userPlan={userPlan} onNavigateToSubscription={() => handleNavigate("subscription")} />;
      case "door-registration": return <OrganizerDoorRegistration userId={userId} isPaid={isPaid} onRequirePlan={handleRequirePlan} onNavigateToSubscription={() => handleNavigate("subscription")} />;
      case "surveys": return <OrganizerSurveys userId={userId} userPlan={userPlan} subscriptionEnabled={subscriptionEnabled} isPaid={isPaid} onRequirePlan={handleRequirePlan} />;
      case "analytics": return <OrganizerAnalytics userId={userId} userPlan={userPlan} subscriptionEnabled={subscriptionEnabled} />;
      case "attendee-intelligence": return <AttendeeIntelligence userId={userId} />;
      case "vendors": return <OrganizerVendors userId={userId} />;
      case "profile": return <OrganizerProfileEdit userId={userId} />;
      case "sharing": return <OrganizerSharing userId={userId} />;
      case "waitlist": return <OrganizerWaitlist userId={userId} isPaid={isPaid} onRequirePlan={handleRequirePlan} />;
      case "discussions": return <OrganizerDiscussions userId={userId} />;
      case "promotion": return <OrganizerPromotion userId={userId} isPaid={isPaid} onRequirePlan={handleRequirePlan} userPlan={userPlan} subscriptionEnabled={subscriptionEnabled} />;
      case "staff-checkin": return <StaffCheckinDashboard userId={userId} userPlan={userPlan} subscriptionEnabled={subscriptionEnabled} />;
      
      case "subscription": return <OrganizerSubscription userId={userId} onRequirePlan={handleRequirePlan} />;
      case "settings": return <OrganizerSettings userId={userId} />;
      case "notifications": return <OrganizerNotifications userId={userId} />;
      default: return <OrganizerOverview userId={userId} onNavigate={handleNavigate} />;
    }
  };

  return (
    <SubscriptionGate userId={userId}>
      <SEO title="Organizer Dashboard" description="Manage your events, registrations, and analytics on VERS" path="/organizer" noindex />
      <div className="min-h-screen bg-background">
        <OrganizerSidebar active={section} onNavigate={handleNavigate} open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} onSignOut={handleSignOut} userPlan={userPlan} subscriptionEnabled={subscriptionEnabled} isExplorer={isExplorer && !isPaid} />
        <div className="lg:pl-64">
          <OrganizerTopBar section={section} searchQuery={searchQuery} onSearchChange={setSearchQuery} onNotifications={() => handleNavigate("notifications")} onNavigate={handleNavigate} />
          <main className="p-3 sm:p-4 md:p-6">
            <PageGuide section={section} visible={!isPaid} onRequirePlan={handleRequirePlan} />
            {renderSection()}
          </main>
        </div>
      </div>
      <PlanPromptDialog open={showPlanModal} onClose={() => setShowPlanModal(false)} userId={userId} />
      <WelcomeSubscriptionDialog open={showWelcome} onClose={() => setShowWelcome(false)} plan={userPlan} />
    </SubscriptionGate>
  );
};

export default OrganizerDashboard;

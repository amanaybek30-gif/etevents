import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import ScrollToTop from "@/components/ScrollToTop";
import Index from "./pages/Index";
import ConfirmAttendance from "./pages/ConfirmAttendance";
import EventProfile from "./pages/EventProfile";
import Events from "./pages/Events";
import CreateEvent from "./pages/CreateEvent";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import OrganizerAuth from "./pages/OrganizerAuth";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import OrganizerProfile from "./pages/OrganizerProfile";
import SavedEvents from "./pages/SavedEvents";
import VendorRegister from "./pages/VendorRegister";
import Help from "./pages/Help";
import QuickRegister from "./pages/QuickRegister";
import SurveyPage from "./pages/SurveyPage";
import StaffCheckin from "./pages/StaffCheckin";
import AttendeeAuth from "./pages/AttendeeAuth";
import AttendeeAccount from "./pages/AttendeeAccount";
import About from "./pages/About";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const AnnouncementWrapper = () => {
  const location = useLocation();
  const hiddenPaths = ["/admin", "/organizer", "/staff-checkin"];
  const shouldHide = hiddenPaths.some((p) => location.pathname.startsWith(p));

  if (shouldHide) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-40">
      <AnnouncementBanner />
    </div>
  );
};

const App = () => {
  if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <AnnouncementWrapper />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/event/:slug" element={<EventProfile />} />
            <Route path="/event/:slug/quick-register" element={<QuickRegister />} />
            <Route path="/event/:slug/vendor-register" element={<VendorRegister />} />
            <Route path="/survey/:surveyId" element={<SurveyPage />} />
            <Route path="/events" element={<Events />} />
            <Route path="/saved-events" element={<SavedEvents />} />
            <Route path="/organizer/:id" element={<OrganizerProfile />} />
            <Route path="/create-event" element={<CreateEvent />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/organizer-auth" element={<OrganizerAuth />} />
            <Route path="/organizer" element={<OrganizerDashboard />} />
            <Route path="/staff-checkin/:token" element={<StaffCheckin />} />
            <Route path="/attendee-auth" element={<AttendeeAuth />} />
            <Route path="/my-account" element={<AttendeeAccount />} />
            <Route path="/help" element={<Help />} />
            <Route path="/about" element={<About />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/confirm-attendance" element={<ConfirmAttendance />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

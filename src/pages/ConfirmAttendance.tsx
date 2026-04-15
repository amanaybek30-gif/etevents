import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Loader2, PartyPopper, Frown, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SEO from "@/components/SEO";

type PageStatus = "loading" | "enter_email" | "ready" | "confirmed" | "cancelled" | "already" | "not_registered" | "error";
type AttendanceStatus = "confirmed" | "cancelled";

type RSVPRecord = {
  fullName: string;
  eventTitle: string;
  attendanceConfirmed: AttendanceStatus | null;
};

const ConfirmAttendance = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ticket = searchParams.get("ticket");
  const eventSlug = searchParams.get("event");
  const requestedAction = searchParams.get("action");
  const [status, setStatus] = useState<PageStatus>("loading");
  const [registration, setRegistration] = useState<RSVPRecord | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [notRegisteredSlug, setNotRegisteredSlug] = useState("");

  // ── Event-based RSVP flow ──
  const isEventBased = !!eventSlug && !ticket;

  // Load event info for event-based flow
  useEffect(() => {
    if (!isEventBased) return;

    const loadEvent = async () => {
      const { data, error } = await supabase.functions.invoke("attendance-rsvp", {
        body: { action: "check_event", eventSlug },
      });

      if (error || !data?.eventTitle) {
        setStatus("error");
        return;
      }

      setEventTitle(data.eventTitle);
      setStatus("enter_email");
    };

    void loadEvent();
  }, [isEventBased, eventSlug]);

  // Handle event-based confirm/cancel
  const handleEventRSVP = async (attendanceStatus: AttendanceStatus) => {
    if (!email.trim()) {
      setEmailError("Please enter your email address");
      return;
    }

    setEmailError("");
    setStatus("loading");

    const { data, error } = await supabase.functions.invoke("attendance-rsvp", {
      body: { action: "confirm_by_email", eventSlug, email: email.trim(), attendanceStatus },
    });

    if (error || !data) {
      setStatus("error");
      return;
    }

    if (data.notRegistered) {
      setNotRegisteredSlug(data.eventSlug);
      setStatus("not_registered");
      return;
    }

    const record: RSVPRecord = {
      fullName: data.fullName || "there",
      eventTitle: data.eventTitle || eventTitle || "this event",
      attendanceConfirmed: data.attendanceConfirmed ?? null,
    };

    setRegistration(record);

    // If already confirmed and user clicked confirm again, show "already confirmed"
    if (data.alreadyConfirmed) {
      setStatus("already");
      return;
    }

    setStatus(attendanceStatus === "confirmed" ? "confirmed" : "cancelled");
  };

  // ── Legacy ticket-based flow ──
  const loadOrUpdateRSVP = useCallback(
    async (nextStatus?: AttendanceStatus) => {
      if (!ticket) {
        setStatus("error");
        return;
      }

      setStatus("loading");

      const { data, error } = await supabase.functions.invoke("attendance-rsvp", {
        body: nextStatus
          ? { action: "set", ticket, attendanceStatus: nextStatus }
          : { action: "get", ticket },
      });

      if (error || !data) {
        setStatus("error");
        return;
      }

      const record: RSVPRecord = {
        fullName: data.fullName || "there",
        eventTitle: data.eventTitle || "this event",
        attendanceConfirmed: data.attendanceConfirmed ?? null,
      };

      setRegistration(record);

      if (record.attendanceConfirmed === "confirmed") {
        setStatus(nextStatus === "confirmed" || requestedAction === "confirm" ? "confirmed" : "already");
        return;
      }

      if (record.attendanceConfirmed === "cancelled") {
        setStatus("cancelled");
        return;
      }

      setStatus("ready");
    },
    [requestedAction, ticket],
  );

  useEffect(() => {
    if (isEventBased) return; // handled separately
    if (!ticket) {
      setStatus("error");
      return;
    }

    if (requestedAction === "confirm") {
      void loadOrUpdateRSVP("confirmed");
      return;
    }

    if (requestedAction === "cancel") {
      void loadOrUpdateRSVP("cancelled");
      return;
    }

    void loadOrUpdateRSVP();
  }, [isEventBased, loadOrUpdateRSVP, requestedAction, ticket]);

  const handleConfirm = () => {
    if (isEventBased) {
      void handleEventRSVP("confirmed");
    } else {
      void loadOrUpdateRSVP("confirmed");
    }
  };

  const handleCancel = () => {
    if (isEventBased) {
      void handleEventRSVP("cancelled");
    } else {
      void loadOrUpdateRSVP("cancelled");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <SEO title="Confirm Attendance" description="Confirm or cancel your event attendance on VERS." path="/confirm-attendance" noindex />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-4 text-center">
          <XCircle className="mx-auto h-16 w-16 text-destructive" />
          <h1 className="text-2xl font-bold text-foreground">Invalid Link</h1>
          <p className="text-muted-foreground">
            This attendance confirmation link is invalid, expired, or no longer available.
          </p>
        </div>
      </div>
    );
  }

  if (status === "not_registered") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-4 text-center">
          <XCircle className="mx-auto h-16 w-16 text-amber-500" />
          <h1 className="text-2xl font-bold text-foreground">Not Registered</h1>
          <p className="text-muted-foreground">
            We couldn&apos;t find a registration with the email <strong className="text-foreground">{email}</strong> for{" "}
            <strong className="text-foreground">{eventTitle}</strong>. You need to register first before confirming attendance.
          </p>
          <div className="pt-4">
            <Button onClick={() => navigate(`/event/${notRegisteredSlug}`)} className="bg-primary px-8 text-primary-foreground hover:bg-primary/90">
              Register Here
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "enter_email") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md w-full space-y-6 text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Confirm Your Attendance</h1>
          <p className="text-muted-foreground">
            Please enter your registered email to confirm or cancel your attendance for{" "}
            <strong className="text-foreground">{eventTitle}</strong>.
          </p>
          <div className="space-y-3 text-left">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                className="pl-10"
                onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              />
            </div>
            {emailError && <p className="text-sm text-destructive">{emailError}</p>}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={handleConfirm} className="bg-primary px-8 text-primary-foreground hover:bg-primary/90">
              <CheckCircle className="mr-2 h-4 w-4" /> Yes, I&apos;ll Attend!
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              className="border-destructive px-8 text-destructive hover:bg-destructive/10"
            >
              <XCircle className="mr-2 h-4 w-4" /> Can&apos;t Make It
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "confirmed" || status === "already") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-4 text-center">
          <PartyPopper className="mx-auto h-16 w-16 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">
            {status === "already" ? "Already Confirmed!" : "Thank You for Confirming! 🎉"}
          </h1>
          <p className="text-muted-foreground">
            {status === "already"
              ? `You've already confirmed your attendance for ${registration?.eventTitle || "this event"}. We're looking forward to seeing you!`
              : `Thank you for confirming your attendance for ${registration?.eventTitle || "this event"}. We will be waiting for you!`}
          </p>
          <div className="pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="border-destructive text-destructive hover:bg-destructive/10"
            >
              <XCircle className="mr-2 h-4 w-4" /> Cancel Attendance
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-4 text-center">
          <Frown className="mx-auto h-16 w-16 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Oops, Sorry to See You Go! 😢</h1>
          <p className="text-muted-foreground">
            Your attendance for {registration?.eventTitle || "this event"} has been cancelled. We hope to see you at future events!
          </p>
          <div className="pt-4">
            <Button onClick={handleConfirm} className="bg-primary px-8 text-primary-foreground hover:bg-primary/90">
              <CheckCircle className="mr-2 h-4 w-4" /> Actually, I&apos;ll Attend!
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Legacy ticket-based ready state
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md space-y-6 text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Confirm Your Attendance</h1>
        <p className="text-muted-foreground">
          Hi {registration?.fullName}! Please confirm whether you&apos;ll be attending{" "}
          <strong className="text-foreground">{registration?.eventTitle || "the event"}</strong>.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={handleConfirm} className="bg-primary px-8 text-primary-foreground hover:bg-primary/90">
            <CheckCircle className="mr-2 h-4 w-4" /> Yes, I&apos;ll Attend!
          </Button>
          <Button
            variant="outline"
            onClick={handleCancel}
            className="border-destructive px-8 text-destructive hover:bg-destructive/10"
          >
            <XCircle className="mr-2 h-4 w-4" /> Can&apos;t Make It
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmAttendance;

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AttendanceStatus = "confirmed" | "cancelled" | null;

type RegistrationRecord = {
  id: string;
  full_name: string;
  event_id: string;
  attendance_confirmed: AttendanceStatus;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeTicket = (value: unknown) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) return "";
  return trimmed;
};

const fetchRegistration = async (
  supabase: ReturnType<typeof createClient>,
  ticket: string,
): Promise<RegistrationRecord | null> => {
  const { data, error } = await supabase
    .from("registrations")
    .select("id, full_name, event_id, attendance_confirmed")
    .eq("ticket_id", ticket)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as RegistrationRecord | null;
};

const fetchRegistrationByEmail = async (
  supabase: ReturnType<typeof createClient>,
  eventSlug: string,
  email: string,
): Promise<RegistrationRecord | null> => {
  const { data, error } = await supabase
    .from("registrations")
    .select("id, full_name, event_id, attendance_confirmed")
    .eq("event_slug", eventSlug)
    .eq("email", email.toLowerCase().trim())
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as RegistrationRecord | null;
};

const fetchEventTitle = async (
  supabase: ReturnType<typeof createClient>,
  eventId: string,
): Promise<string> => {
  const { data, error } = await supabase
    .from("events")
    .select("title")
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw error;
  return data?.title || "this event";
};

const fetchEventBySlug = async (
  supabase: ReturnType<typeof createClient>,
  slug: string,
): Promise<{ id: string; title: string; slug: string } | null> => {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase environment variables are not configured");
    }

    const payload = await req.json().catch(() => null);
    const action = payload?.action; // "get", "set", "check_event", "confirm_by_email"
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Event-based RSVP: get event info by slug ──
    if (action === "check_event") {
      const eventSlug = typeof payload?.eventSlug === "string" ? payload.eventSlug.trim() : "";
      if (!eventSlug) return jsonResponse({ error: "Missing event slug" }, 400);

      const event = await fetchEventBySlug(supabase, eventSlug);
      if (!event) return jsonResponse({ error: "Event not found" }, 404);

      return jsonResponse({ eventTitle: event.title, eventSlug: event.slug });
    }

    // ── Event-based RSVP: confirm/cancel by email ──
    if (action === "confirm_by_email") {
      const eventSlug = typeof payload?.eventSlug === "string" ? payload.eventSlug.trim() : "";
      const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
      const attendanceStatus = payload?.attendanceStatus;

      if (!eventSlug || !email) return jsonResponse({ error: "Missing event or email" }, 400);
      if (attendanceStatus !== "confirmed" && attendanceStatus !== "cancelled") {
        return jsonResponse({ error: "Invalid attendance status" }, 400);
      }

      const registration = await fetchRegistrationByEmail(supabase, eventSlug, email);
      if (!registration) {
        // Not registered — tell frontend to redirect
        return jsonResponse({ notRegistered: true, eventSlug });
      }

      // Check if already confirmed and user is trying to confirm again
      const alreadyConfirmed =
        attendanceStatus === "confirmed" && registration.attendance_confirmed === "confirmed";

      if (!alreadyConfirmed) {
        const { error: updateError } = await supabase
          .from("registrations")
          .update({
            attendance_confirmed: attendanceStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", registration.id);

        if (updateError) throw updateError;
      }

      const eventTitle = await fetchEventTitle(supabase, registration.event_id);

      return jsonResponse({
        fullName: registration.full_name,
        eventTitle,
        attendanceConfirmed: alreadyConfirmed ? "confirmed" : attendanceStatus,
        alreadyConfirmed,
      });
    }

    // ── Legacy ticket-based flows ──
    const ticket = normalizeTicket(payload?.ticket);
    if (!ticket) {
      return jsonResponse({ error: "Invalid ticket" }, 400);
    }

    const registration = await fetchRegistration(supabase, ticket);
    if (!registration) {
      return jsonResponse({ error: "Registration not found" }, 404);
    }

    if (action === "set") {
      const attendanceStatus = payload?.attendanceStatus;
      if (attendanceStatus !== "confirmed" && attendanceStatus !== "cancelled") {
        return jsonResponse({ error: "Invalid attendance status" }, 400);
      }

      const { error: updateError } = await supabase
        .from("registrations")
        .update({
          attendance_confirmed: attendanceStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", registration.id);

      if (updateError) throw updateError;
      registration.attendance_confirmed = attendanceStatus;
    }

    const eventTitle = await fetchEventTitle(supabase, registration.event_id);

    return jsonResponse({
      fullName: registration.full_name,
      eventTitle,
      attendanceConfirmed: registration.attendance_confirmed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("attendance-rsvp error:", message);
    return jsonResponse({ error: "Failed to process attendance confirmation" }, 500);
  }
});

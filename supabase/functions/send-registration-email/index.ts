import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildTelegramConnectUrl } from "../_shared/public-app-url.ts";
import { getTypeContent } from "../_shared/email-type-content.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const { eventTitle, fullName, email, eventSlug, attendeeType, tierName } = await req.json();

    if (!email || !eventTitle || !fullName || !eventSlug) {
      throw new Error("Missing required fields");
    }
    if (typeof email !== "string" || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email");
    }
    if (typeof fullName !== "string" || fullName.length > 200) {
      throw new Error("Invalid name");
    }
    if (typeof eventSlug !== "string" || eventSlug.length > 200) {
      throw new Error("Invalid event slug");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: reg } = await supabaseAdmin
      .from("registrations")
      .select("id, ticket_id, created_at, event_id")
      .eq("email", email)
      .eq("event_slug", eventSlug)
      .gte("created_at", twoMinutesAgo)
      .limit(1)
      .single();

    if (!reg) {
      return new Response(JSON.stringify({ error: "No recent registration found" }), { status: 404, headers: corsHeaders });
    }

    const { data: event } = await supabaseAdmin
      .from("events")
      .select("title, date, time, location, duration, organizer_id")
      .eq("id", reg.event_id)
      .single();

    let organizerEmail = "contact@vionevents.com";
    let organizerName = "VERS";
    if (event?.organizer_id) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(event.organizer_id);
      if (authUser?.user?.email) organizerEmail = authUser.user.email;
      const { data: orgProfile } = await supabaseAdmin
        .from("organizer_profiles")
        .select("organization_name")
        .eq("user_id", event.organizer_id)
        .single();
      if (orgProfile?.organization_name) organizerName = orgProfile.organization_name;
    }

    const esc = (s: string) => s.replace(/[<>&"']/g, (c: string) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c));
    const safeName = esc(fullName);
    const safeTitle = esc(eventTitle);

    const eventDate = event?.date || "TBA";
    const eventTime = event?.time || "TBA";
    const eventLocation = event?.location || "TBA";
    const eventDuration = event?.duration || "";

    const tc = getTypeContent(attendeeType || "participant", tierName || null);

    const telegramConnectUrl = buildTelegramConnectUrl({ email, fullName });

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#000000;font-family:'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:16px;overflow:hidden;border:1px solid #1a1a1a;">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#E6A817 0%,#FFD54F 50%,#E6A817 100%);padding:36px 40px;text-align:center;">
    <h1 style="margin:0;font-size:24px;font-weight:800;color:#0a0a0a;line-height:1.3;">${esc(tc.registrationSubjectPrefix)}</h1>
  </td></tr>

  <!-- Badge -->
  <tr><td style="padding:24px 40px 0;text-align:center;">
    <span style="display:inline-block;background:${tc.badgeColor};color:${tc.badgeTextColor};padding:6px 20px;border-radius:99px;font-size:12px;font-weight:700;letter-spacing:1px;">${esc(tc.badge)}</span>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:20px 40px 0;">
    <p style="margin:0;font-size:16px;color:#ffffff;font-weight:500;">Hi ${safeName},</p>
    <p style="margin:14px 0 0;font-size:14px;color:#a1a1aa;line-height:1.8;">
      ${tc.registrationGreeting.replace("{eventTitle}", safeTitle)}
    </p>
  </td></tr>

  <!-- Registration Info -->
  <tr><td style="padding:24px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #222222;border-radius:12px;overflow:hidden;">
      <tr><td style="background:linear-gradient(90deg,#E6A817,#FFD54F);padding:1px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:11px;">
          <tr><td style="padding:16px 20px;border-bottom:1px solid #222222;">
            <p style="margin:0;font-size:12px;font-weight:700;color:#E6A817;letter-spacing:2px;text-transform:uppercase;">Registration Details</p>
          </td></tr>
          <tr><td style="padding:16px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#71717a;width:130px;">Full Name</td>
                <td style="padding:8px 0;font-size:13px;color:#ffffff;font-weight:500;">${safeName}</td>
              </tr>
              <tr><td colspan="2" style="border-bottom:1px solid #1a1a1a;"></td></tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#71717a;">Registration ID</td>
                <td style="padding:8px 0;font-size:14px;color:#E6A817;font-weight:700;font-family:'Courier New',monospace;letter-spacing:1px;">${reg.ticket_id}</td>
              </tr>
              <tr><td colspan="2" style="border-bottom:1px solid #1a1a1a;"></td></tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#71717a;">Access Type</td>
                <td style="padding:8px 0;">
                  <span style="display:inline-block;background:${tc.badgeColor};color:${tc.badgeTextColor};padding:3px 12px;border-radius:99px;font-size:11px;font-weight:700;">${esc(tc.badge)}</span>
                </td>
              </tr>
              <tr><td colspan="2" style="border-bottom:1px solid #1a1a1a;"></td></tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#71717a;">Status</td>
                <td style="padding:8px 0;">
                  <span style="display:inline-block;background:#E6A817;color:#0a0a0a;padding:3px 12px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:0.5px;">⏳ Pending Confirmation</span>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- Event Details -->
  <tr><td style="padding:0 40px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #222222;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:16px 20px;border-bottom:1px solid #222222;">
        <p style="margin:0;font-size:12px;font-weight:700;color:#E6A817;letter-spacing:2px;text-transform:uppercase;">Event Details</p>
      </td></tr>
      <tr><td style="padding:16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#71717a;width:130px;">Event</td>
            <td style="padding:8px 0;font-size:13px;color:#ffffff;font-weight:600;">${safeTitle}</td>
          </tr>
          <tr><td colspan="2" style="border-bottom:1px solid #1a1a1a;"></td></tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#71717a;">Date</td>
            <td style="padding:8px 0;font-size:13px;color:#ffffff;">${eventDate}</td>
          </tr>
          <tr><td colspan="2" style="border-bottom:1px solid #1a1a1a;"></td></tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#71717a;">Time</td>
            <td style="padding:8px 0;font-size:13px;color:#ffffff;">${eventTime}</td>
          </tr>
          <tr><td colspan="2" style="border-bottom:1px solid #1a1a1a;"></td></tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#71717a;">Location</td>
            <td style="padding:8px 0;font-size:13px;color:#ffffff;">${eventLocation}</td>
          </tr>
          ${eventDuration ? `<tr><td colspan="2" style="border-bottom:1px solid #1a1a1a;"></td></tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#71717a;">Duration</td>
            <td style="padding:8px 0;font-size:13px;color:#ffffff;">${eventDuration}</td>
          </tr>` : ""}
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- Type-specific perks -->
  ${tc.perksHtml}

  <!-- Telegram Connect -->
  <tr><td style="padding:0 40px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d2137;border:1px solid #0088cc33;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:24px;text-align:center;">
        <p style="margin:0 0 8px;font-size:14px;color:#ffffff;font-weight:600;">📲 Get Telegram Reminders &amp; Updates</p>
        <p style="margin:0 0 16px;font-size:12px;color:#a3a3a3;line-height:1.5;">Connect your Telegram to receive organizer updates and automatic event reminders.</p>
        <a href="${telegramConnectUrl}" style="display:inline-block;background:#0088cc;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:8px;">Connect Telegram</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Closing -->
  <tr><td style="padding:0 40px 32px;">
    <p style="margin:0;font-size:14px;color:#a1a1aa;line-height:1.8;">
      We appreciate your interest! You'll be notified once your registration is confirmed. Feel free to reach out if you have any questions.
    </p>
    <p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">${tc.closingLine}</p>
  </td></tr>

  <!-- Divider -->
  <tr><td style="padding:0 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#E6A817,transparent);"></div></td></tr>

  <!-- Footer -->
  <tr><td style="padding:28px 40px;text-align:center;">
    <p style="margin:0 0 4px;font-size:16px;font-weight:800;color:#E6A817;letter-spacing:3px;">VERS</p>
    <p style="margin:0 0 16px;font-size:11px;color:#52525b;letter-spacing:0.5px;">Seamless events, every time.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="padding:0 10px;"><a href="https://www.instagram.com/vionevents" style="color:#71717a;text-decoration:none;font-size:11px;">Instagram</a></td>
        <td style="color:#333;font-size:11px;">•</td>
        <td style="padding:0 10px;"><a href="https://t.me/vionevents" style="color:#71717a;text-decoration:none;font-size:11px;">Telegram</a></td>
        <td style="color:#333;font-size:11px;">•</td>
        <td style="padding:0 10px;"><a href="https://www.linkedin.com/company/vion-events/" style="color:#71717a;text-decoration:none;font-size:11px;">LinkedIn</a></td>
      </tr>
    </table>
    <p style="margin:16px 0 0;font-size:10px;color:#3f3f46;">&copy; 2026 VERS. All rights reserved.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "VERS <vers@vionevents.com>",
        reply_to: organizerEmail,
        to: [email],
        subject: `${tc.registrationSubjectPrefix} — ${eventTitle}`,
        html: emailHtml,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(`Resend API error [${res.status}]: ${JSON.stringify(data)}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Email error:", msg);
    return new Response(JSON.stringify({ error: "Failed to send email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

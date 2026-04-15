import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildConfirmAttendanceUrl, buildTelegramConnectUrl } from "../_shared/public-app-url.ts";
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const hasPermission = roles?.some((r: any) => ["admin", "organizer"].includes(r.role));
    if (!hasPermission) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), { status: 403, headers: corsHeaders });
    }

    const { ticketId, fullName, email, eventTitle, eventSlug, attendeeType, tierName } = await req.json();
    if (!email || !ticketId || !eventTitle) throw new Error("Missing required fields");

    const { data: event } = await supabaseAdmin
      .from("events")
      .select("title, date, time, location, duration, organizer_id")
      .eq("slug", eventSlug)
      .single();

    let organizerEmail = "contact@vionevents.com";
    let organizerName = "VERS";
    const organizerId = event?.organizer_id || userId;
    if (organizerId) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(organizerId);
      if (authUser?.user?.email) organizerEmail = authUser.user.email;
      const { data: orgProfile } = await supabaseAdmin
        .from("organizer_profiles")
        .select("organization_name")
        .eq("user_id", organizerId)
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

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(ticketId)}&bgcolor=FFFFFF&color=000000&margin=4&format=png&ecc=H`;

    const confirmAttendanceUrl = buildConfirmAttendanceUrl(ticketId);
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
    <h1 style="margin:0;font-size:24px;font-weight:800;color:#0a0a0a;line-height:1.3;">${esc(tc.approvalSubjectPrefix)}</h1>
  </td></tr>

  <!-- Badge -->
  <tr><td style="padding:24px 40px 0;text-align:center;">
    <span style="display:inline-block;background:${tc.badgeColor};color:${tc.badgeTextColor};padding:6px 20px;border-radius:99px;font-size:12px;font-weight:700;letter-spacing:1px;">${esc(tc.badge)}</span>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:20px 40px 0;">
    <p style="margin:0;font-size:16px;color:#ffffff;font-weight:500;">Hi ${safeName},</p>
    <p style="margin:14px 0 0;font-size:15px;color:#FFD54F;line-height:1.6;font-weight:500;">
      ${tc.approvalGreeting}
    </p>
    <p style="margin:8px 0 0;font-size:14px;color:#a1a1aa;line-height:1.8;">
      Below are your ticket details and event information.
    </p>
  </td></tr>

  <!-- Event Details -->
  <tr><td style="padding:24px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #222222;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:16px 20px;border-bottom:1px solid #222222;">
        <p style="margin:0;font-size:12px;font-weight:700;color:#E6A817;letter-spacing:2px;text-transform:uppercase;">Event Details</p>
      </td></tr>
      <tr><td style="padding:16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#71717a;width:130px;">Full Name</td>
            <td style="padding:8px 0;font-size:13px;color:#ffffff;font-weight:500;">${safeName}</td>
          </tr>
          <tr><td colspan="2" style="border-bottom:1px solid #1a1a1a;"></td></tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#71717a;">Event</td>
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
          <tr><td colspan="2" style="border-bottom:1px solid #1a1a1a;"></td></tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#71717a;">Ticket ID</td>
            <td style="padding:8px 0;font-size:15px;color:#E6A817;font-weight:700;font-family:'Courier New',monospace;letter-spacing:2px;">${ticketId}</td>
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
              <span style="display:inline-block;background:#14532d;color:#4ade80;padding:3px 12px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:0.5px;">✓ Confirmed</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- Type-specific perks -->
  ${tc.perksHtml}

  <!-- QR Code Section -->
  <tr><td style="padding:0 40px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #222222;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:24px;text-align:center;">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#71717a;font-weight:600;">Your Check-in QR Code</p>
        <p style="margin:0 0 20px;font-size:11px;color:#52525b;">Present this at the event entrance</p>
        <div style="display:inline-block;background:linear-gradient(135deg,#E6A817,#FFD54F);padding:16px;border-radius:16px;box-shadow:0 0 30px rgba(230,168,23,0.25),0 0 60px rgba(230,168,23,0.1);">
          <div style="background:#E6A817;padding:8px;border-radius:10px;">
            <img src="${qrUrl}" alt="QR Code" width="200" height="200" style="display:block;border-radius:6px;" />
          </div>
        </div>
        <p style="margin:20px 0 0;font-size:13px;color:#E6A817;font-weight:600;font-family:'Courier New',monospace;letter-spacing:2px;">${ticketId}</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- Confirm Attendance -->
  <tr><td style="padding:0 40px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d2137;border:1px solid rgba(34,197,94,0.2);border-radius:12px;overflow:hidden;">
      <tr><td style="padding:24px;text-align:center;">
        <p style="margin:0 0 8px;font-size:14px;color:#ffffff;font-weight:600;">📋 Will you be attending?</p>
        <p style="margin:0 0 16px;font-size:12px;color:#a3a3a3;line-height:1.5;">Let the organizer know if you'll make it — it helps them plan better.</p>
        <a href="${confirmAttendanceUrl}" style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:8px;">✓ Confirm Attendance</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Telegram Connect -->
  <tr><td style="padding:0 40px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d2137;border:1px solid #0088cc33;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:24px;text-align:center;">
        <p style="margin:0 0 8px;font-size:14px;color:#ffffff;font-weight:600;">📲 Stay in the Loop on Telegram</p>
        <p style="margin:0 0 16px;font-size:12px;color:#a3a3a3;line-height:1.5;">Connect your Telegram to receive organizer announcements plus 24h, 6h, and 1h reminders before the event.</p>
        <a href="${telegramConnectUrl}" style="display:inline-block;background:#0088cc;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:8px;">Connect Telegram</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Note -->
  <tr><td style="padding:0 40px 32px;">
    <p style="margin:0;font-size:14px;color:#a1a1aa;line-height:1.8;">
      Please keep this email safe — you'll need your QR code or Ticket ID for entry. We look forward to seeing you there!
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
        subject: `${tc.approvalSubjectPrefix} — ${eventTitle}`,
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

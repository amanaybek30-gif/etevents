import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const { staffId, checkinUrl } = await req.json();
    if (!staffId || !checkinUrl) {
      throw new Error("Missing staffId or checkinUrl");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch staff record
    const { data: staff } = await supabaseAdmin
      .from("event_staff")
      .select("name, email, event_id, organizer_id")
      .eq("id", staffId)
      .single();

    if (!staff) {
      return new Response(JSON.stringify({ error: "Staff not found" }), { status: 404, headers: corsHeaders });
    }

    // Verify caller is the organizer
    if (staff.organizer_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    if (!staff.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staff.email)) {
      return new Response(JSON.stringify({ skipped: true, reason: "No valid email" }), { status: 200, headers: corsHeaders });
    }

    // Fetch event details
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("title, date, time, location")
      .eq("id", staff.event_id)
      .single();

    if (!event) {
      return new Response(JSON.stringify({ error: "Event not found" }), { status: 404, headers: corsHeaders });
    }

    // Fetch organizer info
    let organizerName = "VERS";
    const { data: orgProfile } = await supabaseAdmin
      .from("organizer_profiles")
      .select("organization_name")
      .eq("user_id", staff.organizer_id)
      .single();
    if (orgProfile?.organization_name) organizerName = orgProfile.organization_name;

    const esc = (s: string) => s.replace(/[<>&"']/g, (c: string) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c));
    const safeName = esc(staff.name);
    const safeTitle = esc(event.title);
    const safeOrg = esc(organizerName);

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
    <h1 style="margin:0;font-size:28px;font-weight:800;color:#0a0a0a;line-height:1.3;">You're Invited! 🎫</h1>
    <p style="margin:8px 0 0;font-size:14px;color:#0a0a0a;font-weight:600;">Check-In Staff Assignment</p>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:32px 40px 0;">
    <p style="margin:0;font-size:18px;color:#ffffff;font-weight:600;">Hi ${safeName}! 👋</p>
    <p style="margin:16px 0 0;font-size:15px;color:#a1a1aa;line-height:1.8;">
      You've been assigned as a <strong style="color:#FFD54F;">Check-In Staff</strong> for <strong style="color:#ffffff;">${safeTitle}</strong> by <strong style="color:#ffffff;">${safeOrg}</strong>.
    </p>
  </td></tr>

  <!-- Event Info -->
  <tr><td style="padding:24px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #222222;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:16px 20px;border-bottom:1px solid #222222;">
        <p style="margin:0;font-size:12px;font-weight:700;color:#E6A817;letter-spacing:2px;text-transform:uppercase;">Event Details</p>
      </td></tr>
      <tr><td style="padding:16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#71717a;width:100px;">Event</td>
            <td style="padding:8px 0;font-size:13px;color:#ffffff;font-weight:600;">${safeTitle}</td>
          </tr>
          <tr><td colspan="2" style="border-bottom:1px solid #1a1a1a;"></td></tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#71717a;">Date</td>
            <td style="padding:8px 0;font-size:13px;color:#ffffff;">${event.date || "TBA"}</td>
          </tr>
          <tr><td colspan="2" style="border-bottom:1px solid #1a1a1a;"></td></tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#71717a;">Time</td>
            <td style="padding:8px 0;font-size:13px;color:#ffffff;">${event.time || "TBA"}</td>
          </tr>
          <tr><td colspan="2" style="border-bottom:1px solid #1a1a1a;"></td></tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#71717a;">Location</td>
            <td style="padding:8px 0;font-size:13px;color:#ffffff;">${event.location || "TBA"}</td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- CTA Button -->
  <tr><td style="padding:0 40px 24px;text-align:center;">
    <p style="margin:0 0 16px;font-size:14px;color:#a1a1aa;">Use the button below to access your check-in portal. You can scan QR codes or search attendees by name.</p>
    <a href="${checkinUrl}" style="display:inline-block;background:linear-gradient(135deg,#E6A817,#FFD54F);color:#0a0a0a;font-size:16px;font-weight:800;padding:16px 40px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;">Open Check-In Portal</a>
  </td></tr>

  <!-- Link fallback -->
  <tr><td style="padding:0 40px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #222222;border-radius:12px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:1px;">Or copy this link:</p>
        <p style="margin:0;font-size:12px;color:#E6A817;word-break:break-all;font-family:'Courier New',monospace;">${checkinUrl}</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- Instructions -->
  <tr><td style="padding:0 40px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#111111,#1a1a0a);border:1px solid #333300;border-radius:12px;">
      <tr><td style="padding:24px;text-align:center;">
        <p style="margin:0;font-size:32px;">📱📋✅</p>
        <p style="margin:12px 0 0;font-size:16px;font-weight:700;color:#FFD54F;">How It Works</p>
        <p style="margin:10px 0 0;font-size:14px;color:#a1a1aa;line-height:1.7;">
          1. Open the link on your phone or laptop<br>
          2. Scan attendee QR codes or search by name<br>
          3. Confirm check-in with one tap
        </p>
      </td></tr>
    </table>
  </td></tr>

  <!-- Divider -->
  <tr><td style="padding:0 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#E6A817,transparent);"></div></td></tr>

  <!-- Footer -->
  <tr><td style="padding:28px 40px;text-align:center;">
    <p style="margin:0 0 4px;font-size:16px;font-weight:800;color:#E6A817;letter-spacing:3px;">VERS</p>
    <p style="margin:0 0 8px;font-size:11px;color:#52525b;letter-spacing:0.5px;">Seamless events, every time.</p>
    <p style="margin:0;font-size:11px;color:#52525b;">Assigned by ${safeOrg}</p>
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
        to: [staff.email],
        subject: `You're assigned as Check-In Staff for ${event.title} 🎫`,
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
    console.error("Staff invite email error:", msg);
    return new Response(JSON.stringify({ error: "Failed to send email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

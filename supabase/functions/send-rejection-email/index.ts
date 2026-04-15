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

    const { fullName, email, eventTitle, rejectionReason, rejectionDetails } = await req.json();
    if (!email || !fullName || !eventTitle || !rejectionReason) throw new Error("Missing required fields");

    // Fetch organizer info
    let organizerEmail = "contact@vionevents.com";
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authUser?.user?.email) organizerEmail = authUser.user.email;

    const safeName = fullName.replace(/[<>&"']/g, (c: string) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c));
    const safeTitle = eventTitle.replace(/[<>&"']/g, (c: string) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c));
    const safeReason = rejectionReason.replace(/[<>&"']/g, (c: string) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c));
    const safeDetails = (rejectionDetails || "").replace(/[<>&"']/g, (c: string) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c));

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#000000;font-family:'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:16px;overflow:hidden;border:1px solid #1a1a1a;">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#dc2626 0%,#ef4444 50%,#dc2626 100%);padding:36px 40px;text-align:center;">
    <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;line-height:1.3;">Registration Update</h1>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px 40px 0;">
    <p style="margin:0;font-size:16px;color:#ffffff;font-weight:500;">Hi ${safeName},</p>
    <p style="margin:14px 0 0;font-size:15px;color:#a1a1aa;line-height:1.6;">
      We regret to inform you that your registration for <strong style="color:#ffffff;">${safeTitle}</strong> could not be approved.
    </p>
  </td></tr>

  <!-- Reason Card -->
  <tr><td style="padding:24px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #222222;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:16px 20px;border-bottom:1px solid #222222;">
        <p style="margin:0;font-size:12px;font-weight:700;color:#ef4444;letter-spacing:2px;text-transform:uppercase;">Reason for Rejection</p>
      </td></tr>
      <tr><td style="padding:16px 20px;">
        <p style="margin:0;font-size:15px;color:#ffffff;font-weight:600;">${safeReason}</p>
        ${safeDetails ? `<p style="margin:12px 0 0;font-size:14px;color:#a1a1aa;line-height:1.6;">${safeDetails}</p>` : ""}
      </td></tr>
    </table>
  </td></tr>

  <!-- Next Steps -->
  <tr><td style="padding:0 40px 32px;">
    <p style="margin:0;font-size:14px;color:#a1a1aa;line-height:1.8;">
      If you believe this was a mistake or have questions, please reply to this email and the event organizer will get back to you.
    </p>
    <p style="margin:16px 0 0;font-size:14px;color:#a1a1aa;">We appreciate your understanding.</p>
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
        subject: `Registration Update for ${eventTitle}`,
        html: emailHtml,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(`Resend API error [${res.status}]: ${JSON.stringify(data)}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Rejection email error:", msg);
    return new Response(JSON.stringify({ error: "Failed to send rejection email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

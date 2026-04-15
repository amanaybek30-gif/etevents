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

    // Validate JWT authentication
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

    const { fullName, email, phone, organizationName } = await req.json();

    if (!email || !fullName) {
      throw new Error("Missing required fields");
    }
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email");
    }

    const safeName = fullName.replace(/[<>&"']/g, (c: string) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c));
    const safeOrg = (organizationName || "").replace(/[<>&"']/g, (c: string) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c));
    const safePhone = (phone || "N/A").replace(/[<>&"']/g, (c: string) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c));
    const safeEmail = email.replace(/[<>&"']/g, (c: string) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c));

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
    <h1 style="margin:0;font-size:24px;font-weight:800;color:#0a0a0a;line-height:1.3;">Welcome to VERS! 🎉</h1>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:32px 40px 0;">
    <p style="margin:0;font-size:16px;color:#ffffff;font-weight:500;">Hi ${safeName},</p>
    <p style="margin:14px 0 0;font-size:14px;color:#a1a1aa;line-height:1.8;">
      Thank you for joining <strong style="color:#FFD54F;">VERS</strong> as an event organizer! Your account has been created successfully. You can now start creating and managing events on our platform.
    </p>
  </td></tr>

  <!-- Account Details -->
  <tr><td style="padding:24px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #222222;border-radius:12px;overflow:hidden;">
      <tr><td style="background:linear-gradient(90deg,#E6A817,#FFD54F);padding:1px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:11px;">
          <tr><td style="padding:16px 20px;border-bottom:1px solid #222222;">
            <p style="margin:0;font-size:12px;font-weight:700;color:#E6A817;letter-spacing:2px;text-transform:uppercase;">Your Account Details</p>
          </td></tr>
          <tr><td style="padding:16px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#71717a;width:130px;">Name</td>
                <td style="padding:8px 0;font-size:13px;color:#ffffff;font-weight:500;">${safeName}</td>
              </tr>
              <tr><td colspan="2" style="border-bottom:1px solid #1a1a1a;"></td></tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#71717a;">Email</td>
                <td style="padding:8px 0;font-size:13px;color:#ffffff;font-weight:500;">${safeEmail}</td>
              </tr>
              <tr><td colspan="2" style="border-bottom:1px solid #1a1a1a;"></td></tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#71717a;">Phone</td>
                <td style="padding:8px 0;font-size:13px;color:#ffffff;font-weight:500;">${safePhone}</td>
              </tr>
              <tr><td colspan="2" style="border-bottom:1px solid #1a1a1a;"></td></tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#71717a;">Organization</td>
                <td style="padding:8px 0;font-size:13px;color:#ffffff;font-weight:500;">${safeOrg}</td>
              </tr>
              <tr><td colspan="2" style="border-bottom:1px solid #1a1a1a;"></td></tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#71717a;">Account Type</td>
                <td style="padding:8px 0;">
                  <span style="display:inline-block;background:#E6A817;color:#0a0a0a;padding:3px 12px;border-radius:99px;font-size:11px;font-weight:700;letter-spacing:0.5px;">✨ Event Organizer</span>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- Getting Started -->
  <tr><td style="padding:0 40px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #222222;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:16px 20px;border-bottom:1px solid #222222;">
        <p style="margin:0;font-size:12px;font-weight:700;color:#E6A817;letter-spacing:2px;text-transform:uppercase;">Getting Started</p>
      </td></tr>
      <tr><td style="padding:16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#ffffff;line-height:1.6;">
              <strong style="color:#FFD54F;">1.</strong> Log in to your organizer dashboard<br/>
              <strong style="color:#FFD54F;">2.</strong> Create your first event with details & payment info<br/>
              <strong style="color:#FFD54F;">3.</strong> Submit for admin approval<br/>
              <strong style="color:#FFD54F;">4.</strong> Once approved, share your event link!
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- CTA Button -->
  <tr><td style="padding:0 40px 32px;text-align:center;">
    <a href="https://vers.vionevents.com/organizer" style="display:inline-block;background:linear-gradient(135deg,#E6A817,#FFD54F);color:#0a0a0a;font-size:14px;font-weight:700;padding:14px 40px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;">Go to Dashboard →</a>
  </td></tr>

  <!-- Note -->
  <tr><td style="padding:0 40px 32px;">
    <p style="margin:0;font-size:14px;color:#a1a1aa;line-height:1.8;">
      For security, we recommend changing your password after your first login. If you did not create this account, please ignore this email.
    </p>
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
        to: [email],
        subject: "Welcome to VERS — Your Organizer Account is Ready! 🎉",
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
    console.error("Welcome email error:", msg);
    return new Response(JSON.stringify({ error: "Failed to send welcome email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

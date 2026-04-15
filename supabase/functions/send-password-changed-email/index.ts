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
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.is_anonymous) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fullName } = await req.json();

    // Only allow sending to the authenticated user's own email
    const email = user.email;
    if (!email) throw new Error("No email associated with this account");

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    if (!email || !fullName) throw new Error("Missing required fields");

    const safeName = fullName.replace(/[<>&"']/g, (c: string) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c));
    const now = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#000000;font-family:'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:16px;overflow:hidden;border:1px solid #1a1a1a;">

  <tr><td style="background:linear-gradient(135deg,#E6A817 0%,#FFD54F 50%,#E6A817 100%);padding:36px 40px;text-align:center;">
    <h1 style="margin:0;font-size:24px;font-weight:800;color:#0a0a0a;line-height:1.3;">🔒 Password Changed</h1>
  </td></tr>

  <tr><td style="padding:32px 40px 0;">
    <p style="margin:0;font-size:16px;color:#ffffff;font-weight:500;">Hi ${safeName},</p>
    <p style="margin:14px 0 0;font-size:14px;color:#a1a1aa;line-height:1.8;">
      Your password has been successfully changed on <strong style="color:#FFD54F;">VERS</strong>.
    </p>
  </td></tr>

  <tr><td style="padding:24px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #222222;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:16px 20px;border-bottom:1px solid #222222;">
        <p style="margin:0;font-size:12px;font-weight:700;color:#FFD54F;letter-spacing:2px;text-transform:uppercase;">Security Notice</p>
      </td></tr>
      <tr><td style="padding:16px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#71717a;width:130px;">Changed At</td>
            <td style="padding:8px 0;font-size:13px;color:#ffffff;font-weight:500;">${now}</td>
          </tr>
          <tr><td colspan="2" style="border-bottom:1px solid #1a1a1a;"></td></tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#71717a;">Status</td>
            <td style="padding:8px 0;">
              <span style="display:inline-block;background:#14532d;color:#4ade80;padding:3px 12px;border-radius:99px;font-size:11px;font-weight:700;">✓ Successful</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 40px 32px;">
    <p style="margin:0;font-size:14px;color:#a1a1aa;line-height:1.8;">
      If you did not make this change, please contact support immediately or reset your password.
    </p>
  </td></tr>

  <tr><td style="padding:0 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#FFD54F,transparent);"></div></td></tr>

  <tr><td style="padding:28px 40px;text-align:center;">
    <p style="margin:0 0 4px;font-size:16px;font-weight:800;color:#FFD54F;letter-spacing:3px;">VERS</p>
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
        subject: "Your VERS Password Has Been Changed",
        html: emailHtml,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(`Resend error [${res.status}]: ${JSON.stringify(data)}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Password changed email error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

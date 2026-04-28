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
    const { email, redirectTo } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(cleanEmail)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Block banned/suspended emails
    const { data: banned } = await admin.from("banned_emails").select("id").eq("email", cleanEmail).maybeSingle();
    if (banned) {
      return new Response(JSON.stringify({ error: "This account is suspended or removed. Contact admin." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalRedirect = redirectTo || "https://vers.vionevents.com/reset-password";

    // Generate the secure recovery link via admin API (does NOT send Supabase's email)
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: cleanEmail,
      options: { redirectTo: finalRedirect },
    });

    // Always respond with success to avoid email enumeration, but only send if user exists
    if (linkError || !linkData?.properties?.action_link) {
      console.log("No user or link error for:", cleanEmail, linkError?.message);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actionLink = linkData.properties.action_link;
    const safeEmail = cleanEmail.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c));

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reset your VERS password</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#E6A817,#FFD54F);border-radius:12px;">
        <span style="font-size:24px;font-weight:800;color:#0a0a0a;letter-spacing:2px;">VERS</span>
      </div>
    </div>

    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:16px;padding:40px 32px;">
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#ffffff;">Reset your password</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#bdbdbd;">
        We received a request to reset the password for <strong style="color:#E6A817;">${safeEmail}</strong>.
        Click the button below to choose a new password. This link is valid for <strong>1 hour</strong>.
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${actionLink}" style="display:inline-block;background:linear-gradient(135deg,#E6A817,#FFD54F);color:#0a0a0a;font-size:14px;font-weight:700;padding:14px 40px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;">Reset Password →</a>
      </div>

      <p style="margin:24px 0 8px;font-size:12px;color:#888;">Or copy and paste this link into your browser:</p>
      <p style="margin:0 0 24px;font-size:11px;color:#666;word-break:break-all;background:#0a0a0a;padding:12px;border-radius:8px;border:1px solid #2a2a2a;">${actionLink}</p>

      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #2a2a2a;">
        <p style="margin:0 0 8px;font-size:13px;color:#bdbdbd;"><strong style="color:#E6A817;">🔒 Security tip:</strong></p>
        <p style="margin:0;font-size:12px;line-height:1.6;color:#888;">
          Your new password must be different from your current and previously used passwords.
          If you didn't request this reset, you can safely ignore this email — your password will remain unchanged.
        </p>
      </div>
    </div>

    <div style="text-align:center;margin-top:24px;">
      <p style="margin:0 0 4px;font-size:12px;color:#666;">VERS by VION Events</p>
      <p style="margin:0;font-size:11px;color:#555;">Addis Ababa, Ethiopia · +251 944 010 908</p>
      <p style="margin:8px 0 0;font-size:11px;color:#555;">
        <a href="https://vers.vionevents.com" style="color:#E6A817;text-decoration:none;">vers.vionevents.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "VERS <vers@vionevents.com>",
        to: [cleanEmail],
        subject: "Reset your VERS password",
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", errText);
      throw new Error("Failed to send reset email");
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-password-reset-email error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

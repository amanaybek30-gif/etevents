import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, eventTitle, token, eventSlug } = await req.json();

    if (!email || !name || !eventTitle) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const registrationLink = `${req.headers.get("origin") || "https://vers.vionevents.com"}/event/${eventSlug}`;

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; color: #fff; padding: 40px 0;">
        <div style="max-width: 520px; margin: 0 auto; background: #111; border-radius: 16px; border: 1px solid #222; padding: 32px;">
          <h1 style="font-size: 22px; color: #E6A817; margin: 0 0 16px;">A Spot Has Opened Up! 🎉</h1>
          <p style="color: #ccc; font-size: 14px; line-height: 1.6;">
            Hi <strong style="color: #fff;">${name}</strong>,
          </p>
          <p style="color: #ccc; font-size: 14px; line-height: 1.6;">
            Great news! A spot has opened up for <strong style="color: #E6A817;">${eventTitle}</strong>.
          </p>
          <p style="color: #ccc; font-size: 14px; line-height: 1.6;">
            You have <strong style="color: #fff;">24 hours</strong> to register before the spot is offered to the next person on the waitlist.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${registrationLink}" style="display: inline-block; background: linear-gradient(135deg, #E6A817, #D4A017); color: #000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">
              Register Now →
            </a>
          </div>
          <p style="color: #888; font-size: 12px; text-align: center; margin-top: 24px;">
            This invite expires in 24 hours. Don't miss out!
          </p>
        </div>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "vers@vionevents.com",
        to: [email],
        subject: `A spot opened up for ${eventTitle}!`,
        html: emailHtml,
      }),
    });

    const result = await res.json();
    console.log("Waitlist invite email sent:", result);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending waitlist invite:", error);
    return new Response(JSON.stringify({ error: "Failed to send invite" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

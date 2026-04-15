import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();

    // Fetch unconverted abandoned registrations needing reminders
    const { data: abandoned, error } = await supabase
      .from("abandoned_registrations")
      .select("*")
      .eq("converted", false)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) throw error;
    if (!abandoned || abandoned.length === 0) {
      return new Response(JSON.stringify({ message: "No reminders to send", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;

    for (const record of abandoned) {
      const createdAt = new Date(record.created_at);
      let reminderNumber = 0;
      let updateField = "";

      // Determine which reminder to send
      if (!record.reminder_1_sent_at && createdAt.toISOString() <= threeHoursAgo) {
        reminderNumber = 1;
        updateField = "reminder_1_sent_at";
      } else if (
        record.reminder_1_sent_at &&
        !record.reminder_2_sent_at &&
        createdAt.toISOString() <= twentyFourHoursAgo
      ) {
        reminderNumber = 2;
        updateField = "reminder_2_sent_at";
      } else if (
        record.reminder_2_sent_at &&
        !record.reminder_3_sent_at &&
        createdAt.toISOString() <= seventyTwoHoursAgo
      ) {
        reminderNumber = 3;
        updateField = "reminder_3_sent_at";
      }

      if (reminderNumber === 0) continue;

      // Check if they've since registered
      const { data: reg } = await supabase
        .from("registrations")
        .select("id")
        .eq("event_id", record.event_id)
        .eq("email", record.email)
        .limit(1)
        .maybeSingle();

      if (reg) {
        // Already registered — mark converted
        await supabase
          .from("abandoned_registrations")
          .update({ converted: true })
          .eq("id", record.id);
        continue;
      }

      // Check if the event has already passed — don't send reminders for past events
      const { data: eventData } = await supabase
        .from("events")
        .select("date, time")
        .eq("id", record.event_id)
        .maybeSingle();

      if (eventData) {
        const eventDateStr = (eventData.date || "").trim();
        const eventTimeStr = (eventData.time || "00:00").trim();
        // Parse event date+time
        let eventDateTime: Date | null = null;
        try {
          // Try ISO date first
          if (/^\d{4}-\d{2}-\d{2}$/.test(eventDateStr)) {
            const timeParts = eventTimeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
            let hours = 0, minutes = 0;
            if (timeParts) {
              hours = Number(timeParts[1]);
              minutes = Number(timeParts[2] || "0");
              if (timeParts[3]?.toLowerCase() === "pm" && hours !== 12) hours += 12;
              if (timeParts[3]?.toLowerCase() === "am" && hours === 12) hours = 0;
            }
            eventDateTime = new Date(`${eventDateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
          } else {
            eventDateTime = new Date(eventDateStr);
          }
        } catch { eventDateTime = null; }

        if (eventDateTime && !isNaN(eventDateTime.getTime()) && eventDateTime.getTime() < now.getTime()) {
          // Event already passed — mark as converted to stop future reminders
          await supabase
            .from("abandoned_registrations")
            .update({ converted: true })
            .eq("id", record.id);
          continue;
        }
      }

      const name = record.full_name || "there";
      const eventLink = `https://vers.vionevents.com/event/${record.event_slug}`;

      const subjects: Record<number, string> = {
        1: `Don't forget to complete your registration for ${record.event_title}!`,
        2: `Your spot is waiting — finish registering for ${record.event_title}`,
        3: `Last chance to register for ${record.event_title}!`,
      };

      const urgencyMessages: Record<number, string> = {
        1: "We noticed you started registering but didn't finish. Your spot isn't secured yet — complete your registration now!",
        2: "You're still not registered! Spots may be limited, so don't miss out. It only takes a minute to finish.",
        3: "This is your final reminder. Complete your registration now before it's too late!",
      };

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#000;font-family:'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:16px;border:1px solid #1a1a1a;">
<tr><td style="background:linear-gradient(135deg,#E6A817,#FFD54F,#E6A817);padding:32px 40px;text-align:center;">
<h1 style="margin:0;font-size:22px;font-weight:800;color:#0a0a0a;">Complete Your Registration 🎟️</h1>
</td></tr>
<tr><td style="padding:32px 40px;">
<p style="margin:0 0 16px;font-size:16px;color:#fff;font-weight:600;">Hi ${name}!</p>
<p style="margin:0 0 16px;font-size:14px;color:#a1a1aa;line-height:1.8;">${urgencyMessages[reminderNumber]}</p>
<div style="background:#171717;border:1px solid #262626;border-radius:8px;padding:20px;margin:24px 0;">
<p style="margin:0 0 8px;font-size:16px;color:#FFD54F;font-weight:700;">🎉 ${record.event_title}</p>
<p style="margin:0;font-size:13px;color:#a1a1aa;">Don't miss this event — secure your spot now.</p>
</div>
<div style="text-align:center;margin:24px 0;">
<a href="${eventLink}" style="display:inline-block;background:linear-gradient(135deg,#E6A817,#FFD54F);color:#0a0a0a;font-weight:700;font-size:16px;padding:14px 32px;border-radius:8px;text-decoration:none;">Complete Registration →</a>
</div>
</td></tr>
<tr><td style="padding:0 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#E6A817,transparent);"></div></td></tr>
<tr><td style="padding:24px 40px;text-align:center;">
<p style="margin:0;font-size:11px;color:#52525b;">Powered by VERS</p>
</td></tr>
</table></td></tr></table></body></html>`;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "VERS <vers@vionevents.com>",
            to: [record.email],
            subject: subjects[reminderNumber],
            html,
          }),
        });

        if (res.ok) {
          await supabase
            .from("abandoned_registrations")
            .update({ [updateField]: now.toISOString() })
            .eq("id", record.id);
          totalSent++;
        } else {
          const errData = await res.json();
          console.error(`Failed to send reminder ${reminderNumber} to ${record.email}:`, errData);
        }
      } catch (err) {
        console.error(`Error sending reminder to ${record.email}:`, err);
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 300));
    }

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, processed: abandoned.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Abandoned reminder error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

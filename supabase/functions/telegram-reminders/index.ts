import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PUBLIC_APP_URL } from "../_shared/public-app-url.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const APP_URL = PUBLIC_APP_URL;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ATTENDEE_STATUSES = ["approved", "pending"];

const monthIndex: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

const pad = (value: number) => String(value).padStart(2, "0");

function parseEventDateTime(dateValue: string, timeValue?: string | null): Date | null {
  const rawDate = (dateValue || "").trim();
  if (!rawDate) return null;

  let normalizedDate = rawDate;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const rangeMatch = rawDate.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s*-\s*\d{1,2})?,\s*(\d{4})$/);
    if (rangeMatch) {
      const [, monthName, day, year] = rangeMatch;
      const month = monthIndex[monthName.toLowerCase()];
      if (!month) return null;
      normalizedDate = `${year}-${month}-${pad(Number(day))}`;
    } else {
      const parsedDate = new Date(rawDate);
      if (Number.isNaN(parsedDate.getTime())) return null;
      normalizedDate = parsedDate.toISOString().slice(0, 10);
    }
  }

  const rawTime = (timeValue || "00:00").trim();
  let hours = 0;
  let minutes = 0;

  const twentyFourHourMatch = rawTime.match(/^(\d{1,2}):(\d{2})$/);
  const meridiemMatch = rawTime.match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])$/);

  if (twentyFourHourMatch) {
    hours = Number(twentyFourHourMatch[1]);
    minutes = Number(twentyFourHourMatch[2]);
  } else if (meridiemMatch) {
    hours = Number(meridiemMatch[1]) % 12;
    minutes = Number(meridiemMatch[2] || "0");
    if (meridiemMatch[3].toLowerCase() === "pm") hours += 12;
  }

  const parsedDateTime = new Date(`${normalizedDate}T${pad(hours)}:${pad(minutes)}:00`);
  if (Number.isNaN(parsedDateTime.getTime())) return null;

  return parsedDateTime;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
  if (!TELEGRAM_API_KEY) {
    return new Response(JSON.stringify({ error: "TELEGRAM_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const now = new Date();
  let sentCount = 0;
  let errorCount = 0;

  try {
    // Fetch all events that might be upcoming — look ahead 48h to catch various date formats
    const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { data: events } = await supabase
      .from("events")
      .select("id, title, slug, date, time, location, end_date");

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "No upcoming events" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter to only events whose parsed date+time is in the future and within 25h
    const upcomingEvents = events.filter(event => {
      const parsedDT = parseEventDateTime(event.date, event.time);
      if (!parsedDT) return false;
      const diffMs = parsedDT.getTime() - now.getTime();
      // Include events from -1h (for 1h reminder) to +25h (for 24h reminder)
      return diffMs > -1 * 60 * 60 * 1000 && diffMs <= 25 * 60 * 60 * 1000;
    });

    for (const event of upcomingEvents) {
      const parsedEventDateTime = parseEventDateTime(event.date, event.time);
      if (!parsedEventDateTime) {
        continue;
      }
      const eventDateTime = parsedEventDateTime;

      const diffMs = eventDateTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      const remindersToSend: string[] = [];
      if (diffHours > 23 && diffHours <= 25) remindersToSend.push("24h");
      if (diffHours > 5.5 && diffHours <= 6.5) remindersToSend.push("6h");
      if (diffHours > 0.5 && diffHours <= 1.5) remindersToSend.push("1h");

      if (remindersToSend.length === 0) continue;

      const { data: regs } = await supabase
        .from("registrations")
        .select("email")
        .eq("event_id", event.id)
        .in("status", ATTENDEE_STATUSES);

      if (!regs || regs.length === 0) continue;

      const emails = [...new Set(regs.map((r) => r.email))];

      // Get telegram accounts that have reminders enabled
      const chatIdsWithInfo: Array<{ chatId: number }> = [];

      for (const email of emails) {
        const { data: acc } = await supabase
          .from("attendee_accounts")
          .select("user_id")
          .ilike("email", email)
          .limit(1)
          .single();

        if (acc) {
          const { data: tg } = await supabase
            .from("telegram_accounts")
            .select("telegram_chat_id, telegram_reminders_enabled")
            .eq("user_id", acc.user_id)
            .single();
          // Only send if connected AND reminders enabled
          if (tg && tg.telegram_chat_id && tg.telegram_reminders_enabled) {
            chatIdsWithInfo.push({ chatId: tg.telegram_chat_id });
          }
        }
      }

      if (chatIdsWithInfo.length === 0) continue;

      for (const reminderType of remindersToSend) {
        let emoji = "⏰";
        let timeLabel = "";
        if (reminderType === "24h") {
          emoji = "📅";
          timeLabel = "tomorrow";
        } else if (reminderType === "6h") {
          emoji = "⏰";
          timeLabel = "in 6 hours";
        } else if (reminderType === "1h") {
          emoji = "🔔";
          timeLabel = "in 1 hour";
        }

        const message = `${emoji} *Reminder: ${event.title}*\n\nYour event starts ${timeLabel}!\n\n📅 Date: ${event.date}${(event as any).end_date ? ` - ${(event as any).end_date}` : ""}\n🕐 Time: ${event.time}\n📍 Location: ${event.location}`;

        for (const { chatId } of chatIdsWithInfo) {
          const { data: existing } = await supabase
            .from("telegram_reminders")
            .select("id")
            .eq("event_id", event.id)
            .eq("telegram_chat_id", chatId)
            .eq("reminder_type", reminderType)
            .not("sent_at", "is", null)
            .limit(1)
            .single();

          if (existing) continue;

          try {
            const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "X-Connection-Api-Key": TELEGRAM_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "🔗 View Event", url: `${APP_URL}/event/${event.slug}` }],
                    [{ text: "🎟 Get Ticket", callback_data: `get_ticket:${event.id}` }],
                  ],
                },
              }),
            });

            await res.text();

            if (res.ok) {
              await supabase.from("telegram_reminders").insert({
                event_id: event.id,
                telegram_chat_id: chatId,
                reminder_type: reminderType,
                sent_at: new Date().toISOString(),
                scheduled_for: eventDateTime.toISOString(),
              });
              sentCount++;
            } else {
              errorCount++;
            }
          } catch {
            errorCount++;
          }

          await new Promise((r) => setTimeout(r, 50));
        }
      }
    }

    // ─── Post-Event Follow-Up ───
    // Post-event follow-up: check events where parsed date+time is 12-36h in the past
    const { data: allEventsForFollowup } = await supabase
      .from("events")
      .select("id, title, slug, date, time");

    const pastEvents = (allEventsForFollowup || []).filter(event => {
      const parsedDT = parseEventDateTime(event.date, event.time);
      if (!parsedDT) return false;
      const diffMs = now.getTime() - parsedDT.getTime();
      return diffMs > 12 * 60 * 60 * 1000 && diffMs <= 36 * 60 * 60 * 1000;
    });

    if (pastEvents && pastEvents.length > 0) {
      for (const event of pastEvents) {
        const { data: regs } = await supabase
          .from("registrations")
          .select("email")
          .eq("event_id", event.id)
          .eq("status", "approved")
          .eq("checked_in", true);

        if (!regs || regs.length === 0) continue;

        const emails = [...new Set(regs.map((r) => r.email))];

        for (const email of emails) {
          const { data: acc } = await supabase
            .from("attendee_accounts")
            .select("user_id")
            .ilike("email", email)
            .limit(1)
            .single();

          if (!acc) continue;

          const { data: tg } = await supabase
            .from("telegram_accounts")
            .select("telegram_chat_id, telegram_updates_enabled")
            .eq("user_id", acc.user_id)
            .single();

          // Follow-up only if connected AND updates enabled
          if (!tg || !tg.telegram_chat_id || !tg.telegram_updates_enabled) continue;

          const { data: existing } = await supabase
            .from("telegram_reminders")
            .select("id")
            .eq("event_id", event.id)
            .eq("telegram_chat_id", tg.telegram_chat_id)
            .eq("reminder_type", "follow_up")
            .not("sent_at", "is", null)
            .limit(1)
            .single();

          if (existing) continue;

          try {
            const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "X-Connection-Api-Key": TELEGRAM_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                chat_id: tg.telegram_chat_id,
                text: `🙏 *Thank you for attending ${event.title}!*\n\nWe hope you had a great experience. We'd love to hear your feedback!`,
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "📝 Leave Feedback", callback_data: `feedback:${event.id}` }],
                  ],
                },
              }),
            });
            await res.text();

            if (res.ok) {
              await supabase.from("telegram_reminders").insert({
                event_id: event.id,
                telegram_chat_id: tg.telegram_chat_id,
                reminder_type: "follow_up",
                sent_at: new Date().toISOString(),
                scheduled_for: now.toISOString(),
              });
              sentCount++;
            }
          } catch {
            errorCount++;
          }

          await new Promise((r) => setTimeout(r, 50));
        }
      }
    }

    // ─── Re-engagement: Registered but didn't attend ───
    if (pastEvents && pastEvents.length > 0) {
      for (const event of pastEvents) {
        const { data: noShows } = await supabase
          .from("registrations")
          .select("email")
          .eq("event_id", event.id)
          .eq("status", "approved")
          .eq("checked_in", false);

        if (!noShows || noShows.length === 0) continue;

        const emails = [...new Set(noShows.map((r) => r.email))];

        for (const email of emails) {
          const { data: acc } = await supabase
            .from("attendee_accounts")
            .select("user_id")
            .ilike("email", email)
            .limit(1)
            .single();

          if (!acc) continue;

          const { data: tg } = await supabase
            .from("telegram_accounts")
            .select("telegram_chat_id, telegram_updates_enabled")
            .eq("user_id", acc.user_id)
            .single();

          if (!tg || !tg.telegram_chat_id || !tg.telegram_updates_enabled) continue;

          const { data: existing } = await supabase
            .from("telegram_reminders")
            .select("id")
            .eq("event_id", event.id)
            .eq("telegram_chat_id", tg.telegram_chat_id)
            .eq("reminder_type", "re_engagement")
            .not("sent_at", "is", null)
            .limit(1)
            .single();

          if (existing) continue;

          try {
            const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "X-Connection-Api-Key": TELEGRAM_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                chat_id: tg.telegram_chat_id,
                text: `😢 Missed *${event.title}*?\n\nNo worries! Check out upcoming events you might enjoy.`,
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "🔗 Browse Events", url: `${APP_URL}/events` }],
                  ],
                },
              }),
            });
            await res.text();

            if (res.ok) {
              await supabase.from("telegram_reminders").insert({
                event_id: event.id,
                telegram_chat_id: tg.telegram_chat_id,
                reminder_type: "re_engagement",
                sent_at: new Date().toISOString(),
                scheduled_for: now.toISOString(),
              });
              sentCount++;
            }
          } catch {
            errorCount++;
          }

          await new Promise((r) => setTimeout(r, 50));
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent: sentCount, errors: errorCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("telegram-reminders error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

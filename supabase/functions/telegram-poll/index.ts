import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PUBLIC_APP_URL } from "../_shared/public-app-url.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;
const APP_URL = PUBLIC_APP_URL;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ATTENDEE_STATUSES = ["approved", "pending"];
const LINK_TOKEN_REGEX = /^[A-Za-z0-9]{16}$/;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    photo?: Array<{ file_id: string }>;
    document?: { file_id: string; file_name?: string };
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name: string; username?: string };
    message?: { chat: { id: number }; message_id: number };
    data?: string;
  };
}

interface TelegramAccount {
  user_id: string;
  role: string;
  telegram_reminders_enabled: boolean;
  telegram_updates_enabled: boolean;
}

async function telegramApi(
  method: string,
  body: Record<string, unknown>,
  lovableKey: string,
  telegramKey: string
) {
  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": telegramKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`Telegram ${method} failed [${res.status}]:`, data);
  }
  return data;
}

function explorerMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📋 My Events", callback_data: "my_events" }],
      [{ text: "🎟 Get Ticket", callback_data: "get_ticket_menu" }],
      [{ text: "🔍 Explore Events", url: `${APP_URL}/events` }],
      [{ text: "⏰ Reminders", callback_data: "reminders" }],
      [{ text: "📢 Updates", callback_data: "updates" }],
      [{ text: "❓ Help", callback_data: "help" }],
    ],
  };
}

function organizerMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📋 My Events", callback_data: "org_my_events" }],
      [{ text: "➕ Create Event", callback_data: "org_create_event" }],
      [{ text: "📝 Registrations", callback_data: "org_registrations" }],
      [{ text: "💰 Payments", callback_data: "org_payments" }],
      [{ text: "📊 Analytics", callback_data: "org_analytics" }],
      [{ text: "📢 Updates", callback_data: "updates" }],
      [{ text: "❓ Help", callback_data: "help" }],
    ],
  };
}

function getMenuForRole(role: string) {
  return role === "organizer" ? organizerMenuKeyboard() : explorerMenuKeyboard();
}

async function linkTelegramAccountByToken(
  linkToken: string,
  chatId: number,
  username: string,
  supabase: ReturnType<typeof createClient>,
) {
  const { data: tokenAccount, error: tokenError } = await supabase
    .from("telegram_accounts")
    .select("id, user_id, role")
    .eq("link_token", linkToken)
    .maybeSingle();

  if (tokenError) {
    console.error("telegram token lookup failed:", tokenError);
    return null;
  }

  if (!tokenAccount) return null;

  await supabase
    .from("telegram_accounts")
    .update({
      telegram_chat_id: null,
      linked_at: null,
      telegram_username: null,
    })
    .eq("telegram_chat_id", chatId)
    .neq("id", tokenAccount.id);

  const { data: linkedAccount, error: linkError } = await supabase
    .from("telegram_accounts")
    .update({
      telegram_chat_id: chatId,
      telegram_username: username || null,
      linked_at: new Date().toISOString(),
      link_token: null,
      telegram_reminders_enabled: true,
      telegram_updates_enabled: true,
    })
    .eq("id", tokenAccount.id)
    .select("user_id, role")
    .single();

  if (linkError) {
    console.error("telegram token link update failed:", linkError);
    return null;
  }

  return linkedAccount;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

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

  let totalProcessed = 0;

  const { data: state, error: stateErr } = await supabase
    .from("telegram_bot_state")
    .select("update_offset")
    .eq("id", 1)
    .single();

  if (stateErr) {
    return new Response(JSON.stringify({ error: stateErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let currentOffset = state.update_offset;

  while (true) {
    const elapsed = Date.now() - startTime;
    const remainingMs = MAX_RUNTIME_MS - elapsed;
    if (remainingMs < MIN_REMAINING_MS) break;

    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    const updatesResponse = await fetch(`${GATEWAY_URL}/getUpdates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        offset: currentOffset,
        timeout,
        allowed_updates: ["message", "callback_query"],
      }),
    });

    const updatesData = await updatesResponse.json();
    if (!updatesResponse.ok) {
      console.error("getUpdates failed:", updatesData);
      await wait(2000);
      continue;
    }

    const updates: TelegramUpdate[] = updatesData.result ?? [];
    if (updates.length === 0) continue;

    for (const update of updates) {
      try {
        if (update.message?.text) {
          await handleMessage(update, supabase, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        } else if (update.callback_query) {
          await handleCallbackQuery(update.callback_query, supabase, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        }
      } catch (err) {
        console.error("Error processing update:", err);
      }
      totalProcessed++;
    }

    const newOffset = Math.max(...updates.map((u) => u.update_id)) + 1;
    await supabase
      .from("telegram_bot_state")
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq("id", 1);
    currentOffset = newOffset;
  }

  return new Response(
    JSON.stringify({ ok: true, processed: totalProcessed, finalOffset: currentOffset }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

// ─── Helper: get user email ──────────────────────────────────────
async function getUserEmail(userId: string, supabase: ReturnType<typeof createClient>): Promise<string> {
  // Check attendee_accounts first
  const { data: attendee } = await supabase
    .from("attendee_accounts")
    .select("email")
    .eq("user_id", userId)
    .single();
  if (attendee?.email) return attendee.email;
  
  // Check organizer_profiles
  const { data: org } = await supabase
    .from("organizer_profiles")
    .select("email")
    .eq("user_id", userId)
    .single();
  if (org?.email) return org.email;

  // Fallback: check auth user email
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  return authUser?.user?.email || "";
}

// ─── Helper: get all emails associated with a telegram chat ──────
async function getRegistrationEmails(chatId: number, userId: string, supabase: ReturnType<typeof createClient>): Promise<string[]> {
  const emails = new Set<string>();
  const phones = new Set<string>();
  
  // Get emails and phones from attendee_accounts
  const { data: attendee } = await supabase
    .from("attendee_accounts")
    .select("email, phone")
    .eq("user_id", userId)
    .single();
  if (attendee?.email) {
    emails.add(attendee.email);
    emails.add(attendee.email.toLowerCase());
  }
  if (attendee?.phone) phones.add(attendee.phone);

  // Get emails and phones from organizer_profiles
  const { data: org } = await supabase
    .from("organizer_profiles")
    .select("email, phone")
    .eq("user_id", userId)
    .single();
  if (org?.email) {
    emails.add(org.email);
    emails.add(org.email.toLowerCase());
  }
  if (org?.phone) phones.add(org.phone);
  
  // Also check auth user email (may differ from profile)
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  if (authUser?.user?.email) {
    emails.add(authUser.user.email);
    emails.add(authUser.user.email.toLowerCase());
  }
  if (authUser?.user?.phone) {
    phones.add(authUser.user.phone);
  }

  // Cross-reference: find registrations by phone to discover additional emails
  if (phones.size > 0) {
    const { data: phoneRegs } = await supabase
      .from("registrations")
      .select("email")
      .in("phone", Array.from(phones))
      .limit(50);
    if (phoneRegs) {
      for (const r of phoneRegs) {
        emails.add(r.email);
        emails.add(r.email.toLowerCase());
      }
    }
  }

  // Also cross-reference: find registrations by known emails to discover more emails via phone
  if (emails.size > 0) {
    const { data: emailRegs } = await supabase
      .from("registrations")
      .select("email, phone")
      .in("email", Array.from(emails))
      .limit(50);
    if (emailRegs) {
      for (const r of emailRegs) {
        emails.add(r.email);
        emails.add(r.email.toLowerCase());
      }
    }
  }
  
  return Array.from(emails);
}

// ─── Message Handler ──────────────────────────────────────────────
async function handleMessage(
  update: TelegramUpdate,
  supabase: ReturnType<typeof createClient>,
  lovableKey: string,
  telegramKey: string
) {
  const msg = update.message!;
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();
  const username = msg.from.username || "";
  const firstName = msg.from.first_name || "";

  const startToken = text.startsWith("/start") ? text.split(" ")[1] || null : null;
  const manualToken = !text.startsWith("/") && LINK_TOKEN_REGEX.test(text) ? text : null;

  if (startToken || manualToken) {
    const linkToken = startToken || manualToken;
    const account = await linkTelegramAccountByToken(linkToken!, chatId, username, supabase);

    if (!account) {
      const { data: existing } = await supabase
        .from("telegram_accounts")
        .select("id, role, user_id")
        .eq("telegram_chat_id", chatId)
        .single();

      if (existing) {
        const { data: profile } = await supabase
          .from("attendee_accounts")
          .select("full_name")
          .eq("user_id", existing.user_id)
          .single();
        const displayName = profile?.full_name || firstName;

        await telegramApi("sendMessage", {
          chat_id: chatId,
          text: `✅ Your Telegram is already connected to VERS!\n\nWelcome back, ${displayName}!`,
          reply_markup: getMenuForRole(existing.role),
        }, lovableKey, telegramKey);
      } else {
        await telegramApi("sendMessage", {
          chat_id: chatId,
          text: "⚠️ This link has expired or was already used. Please generate a new link from your VERS account.",
        }, lovableKey, telegramKey);
      }
      return;
    }

    const { data: profile } = await supabase
      .from("attendee_accounts")
      .select("full_name")
      .eq("user_id", account.user_id)
      .single();
    const displayName = profile?.full_name || firstName;
    const roleLabel = account.role === "organizer" ? "Organizer" : "Explorer";

    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: `🎉 Welcome to VERS Assistant, ${displayName}!\n\nYour Telegram account is now connected as an *${roleLabel}*.\n\nYou'll receive event reminders and updates once you enable them in your VERS profile settings.`,
      parse_mode: "Markdown",
      reply_markup: getMenuForRole(account.role),
    }, lovableKey, telegramKey);
    return;
  }

  if (text.startsWith("/start")) {
    const { data: existing } = await supabase
      .from("telegram_accounts")
      .select("id, role")
      .eq("telegram_chat_id", chatId)
      .single();

    if (existing) {
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: `Welcome back to VERS Assistant, ${firstName}! 👋\n\nHow can I help you today?`,
        reply_markup: getMenuForRole(existing.role),
      }, lovableKey, telegramKey);
    } else {
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: `👋 Hi ${firstName}!\n\nTo get started, please connect your Telegram from your VERS account:\n\n1. Go to ${APP_URL}\n2. Sign in or create an account\n3. Click "Connect Telegram" in your profile\n\nThis will link your account and enable notifications.`,
      }, lovableKey, telegramKey);
    }
    return;
  }

  if (text === "/menu") {
    const { data: existing } = await supabase
      .from("telegram_accounts")
      .select("role")
      .eq("telegram_chat_id", chatId)
      .single();
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "📌 *VERS Assistant Menu*",
      parse_mode: "Markdown",
      reply_markup: getMenuForRole(existing?.role || "explorer"),
    }, lovableKey, telegramKey);
    return;
  }

  if (msg.photo || msg.document) {
    const { data: account } = await supabase
      .from("telegram_accounts")
      .select("user_id, role")
      .eq("telegram_chat_id", chatId)
      .single();
    if (account) {
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: "📎 Receipt received! Please also provide your transaction number by typing it here, or visit the event page to complete your registration.",
        reply_markup: getMenuForRole(account.role),
      }, lovableKey, telegramKey);
    }
    return;
  }

  const { data: linked } = await supabase
    .from("telegram_accounts")
    .select("id, role")
    .eq("telegram_chat_id", chatId)
    .single();

  if (linked) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "I didn't understand that. Use the menu below to navigate:",
      reply_markup: getMenuForRole(linked.role),
    }, lovableKey, telegramKey);
  } else {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: `Please connect your VERS account first by visiting ${APP_URL} and clicking "Connect Telegram" in your profile.`,
    }, lovableKey, telegramKey);
  }
}

// ─── Callback Query Handler ──────────────────────────────────────
async function handleCallbackQuery(
  query: NonNullable<TelegramUpdate["callback_query"]>,
  supabase: ReturnType<typeof createClient>,
  lovableKey: string,
  telegramKey: string
) {
  const chatId = query.message?.chat?.id;
  if (!chatId) return;

  const data = query.data || "";

  await telegramApi("answerCallbackQuery", { callback_query_id: query.id }, lovableKey, telegramKey);

  const { data: account } = await supabase
    .from("telegram_accounts")
    .select("user_id, role, telegram_reminders_enabled, telegram_updates_enabled")
    .eq("telegram_chat_id", chatId)
    .single();

  if (!account) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: `Please connect your VERS account first at ${APP_URL}`,
    }, lovableKey, telegramKey);
    return;
  }

  const menu = getMenuForRole(account.role);

  // ─── EXPLORER CALLBACKS ───
  if (data === "my_events") {
    await handleMyEvents(chatId, account, supabase, lovableKey, telegramKey);
    return;
  }
  if (data === "get_ticket_menu") {
    await handleGetTicketMenu(chatId, account, supabase, lovableKey, telegramKey);
    return;
  }
  if (data === "event_info_menu") {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "🔍 Explore all available events on VERS:",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔍 Explore Events", url: `${APP_URL}/events` }],
          [{ text: "◀️ Back to Menu", callback_data: "main_menu" }],
        ],
      },
    }, lovableKey, telegramKey);
    return;
  }
  if (data.startsWith("event_details:")) {
    const eventId = data.split(":")[1];
    await handleEventDetails(chatId, eventId, account, supabase, lovableKey, telegramKey);
    return;
  }
  if (data.startsWith("get_ticket:")) {
    const eventId = data.split(":")[1];
    await handleGetTicket(chatId, eventId, account, supabase, lovableKey, telegramKey);
    return;
  }
  if (data.startsWith("register:")) {
    const slug = data.split(":")[1];
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: `📝 Register for this event on VERS:`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔗 Open Registration Page", url: `${APP_URL}/event/${slug}` }],
          [{ text: "◀️ Back to Menu", callback_data: "main_menu" }],
        ],
      },
    }, lovableKey, telegramKey);
    return;
  }
  if (data.startsWith("pay_method:")) {
    const parts = data.split(":");
    await handlePaymentMethod(chatId, parts[1], parts[2], account, supabase, lovableKey, telegramKey);
    return;
  }
  if (data.startsWith("feedback:")) {
    const eventId = data.split(":")[1];
    const { data: survey } = await supabase
      .from("surveys")
      .select("id")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .limit(1)
      .single();
    if (survey) {
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: "📝 We'd love your feedback!",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📋 Open Feedback Form", url: `${APP_URL}/survey/${survey.id}` }],
            [{ text: "◀️ Back to Menu", callback_data: "main_menu" }],
          ],
        },
      }, lovableKey, telegramKey);
    } else {
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: "No feedback form is available for this event yet.",
        reply_markup: { inline_keyboard: [[{ text: "◀️ Back to Menu", callback_data: "main_menu" }]] },
      }, lovableKey, telegramKey);
    }
    return;
  }

  // ─── INFO BUTTON CALLBACKS (from admin broadcasts) ───
  if (data.startsWith("info:") || data.startsWith("info_")) {
    const lookupKey = `tg_btn:${data}`;
    const { data: setting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", lookupKey)
      .single();

    // Fallback: try legacy key format
    let infoMessage = setting?.value;
    if (!infoMessage && data.startsWith("info:")) {
      const legacyKey = `tg_info_btn:${data.slice(5)}`;
      const { data: legacy } = await supabase.from("platform_settings").select("value").eq("key", legacyKey).single();
      infoMessage = legacy?.value || data.slice(5);
    }
    if (!infoMessage) infoMessage = "No additional information available.";

    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: `ℹ️ ${infoMessage}`,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "◀️ Back to Menu", callback_data: "main_menu" }]] },
    }, lovableKey, telegramKey);
    return;
  }

  // ─── PREFERENCE TOGGLES ───
  if (data === "toggle_reminders") {
    const newVal = !account.telegram_reminders_enabled;
    await supabase.from("telegram_accounts").update({ telegram_reminders_enabled: newVal }).eq("telegram_chat_id", chatId);
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: newVal ? "✅ Telegram reminders *enabled*. You'll receive event reminders here." : "❌ Telegram reminders *disabled*.",
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "◀️ Back to Menu", callback_data: "main_menu" }]] },
    }, lovableKey, telegramKey);
    return;
  }
  if (data === "toggle_updates") {
    const newVal = !account.telegram_updates_enabled;
    await supabase.from("telegram_accounts").update({ telegram_updates_enabled: newVal }).eq("telegram_chat_id", chatId);
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: newVal ? "✅ Telegram updates *enabled*. You'll receive organizer announcements here." : "❌ Telegram updates *disabled*.",
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "◀️ Back to Menu", callback_data: "main_menu" }]] },
    }, lovableKey, telegramKey);
    return;
  }

  // ─── REMINDERS ───
  if (data === "reminders") {
    const remindersStatus = account.telegram_reminders_enabled ? "✅ ON" : "❌ OFF";
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: `⏰ *Event Reminders*\n\nStatus: ${remindersStatus}\n\nWhen enabled, you'll receive:\n• 24 hours before the event\n• 6 hours before the event\n• 1 hour before event start`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: account.telegram_reminders_enabled ? "🔕 Disable Reminders" : "🔔 Enable Reminders", callback_data: "toggle_reminders" }],
          [{ text: "◀️ Back to Menu", callback_data: "main_menu" }],
        ],
      },
    }, lovableKey, telegramKey);
    return;
  }

  // ─── UPDATES ───
  if (data === "updates") {
    await handleUpdates(chatId, account, supabase, lovableKey, telegramKey);
    return;
  }

  // ─── HELP ───
  if (data === "help") {
    const helpText = account.role === "organizer"
      ? `❓ *VERS Organizer Help*\n\n🔹 *My Events* — View and manage your events\n🔹 *Create Event* — Create a new event\n🔹 *Registrations* — View attendee registrations\n🔹 *Payments* — Check payment status\n🔹 *Analytics* — View event stats\n🔹 *Updates* — Send announcements\n\n📧 Email: support@vionevents.com\n🌐 Website: ${APP_URL}`
      : `❓ *VERS Explorer Help*\n\n🔹 *My Events* — View your registered and saved events\n🔹 *Get Ticket* — Access your event tickets\n🔹 *Event Info* — View detailed event information\n🔹 *Reminders* — Event reminder settings\n🔹 *Updates* — Latest announcements from organizers\n\n📧 Email: support@vionevents.com\n🌐 Website: ${APP_URL}`;
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: helpText,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "◀️ Back to Menu", callback_data: "main_menu" }]] },
    }, lovableKey, telegramKey);
    return;
  }

  // ─── ORGANIZER CALLBACKS ───
  if (data === "org_my_events") {
    await handleOrgMyEvents(chatId, account, supabase, lovableKey, telegramKey);
    return;
  }
  if (data === "org_create_event") {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "➕ Create a new event on VERS:",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔗 Open Event Creator", url: `${APP_URL}/create-event` }],
          [{ text: "◀️ Back to Menu", callback_data: "main_menu" }],
        ],
      },
    }, lovableKey, telegramKey);
    return;
  }
  if (data === "org_registrations") {
    await handleOrgRegistrations(chatId, account, supabase, lovableKey, telegramKey);
    return;
  }
  if (data === "org_payments") {
    await handleOrgPayments(chatId, account, supabase, lovableKey, telegramKey);
    return;
  }
  if (data === "org_analytics") {
    await handleOrgAnalytics(chatId, account, supabase, lovableKey, telegramKey);
    return;
  }
  if (data.startsWith("org_event_regs:")) {
    const eventId = data.split(":")[1];
    await handleOrgEventRegistrations(chatId, eventId, account, supabase, lovableKey, telegramKey);
    return;
  }
  if (data.startsWith("org_approve_pending:")) {
    const eventId = data.split(":")[1];
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "📋 Manage registrations on your dashboard:",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔗 Open Dashboard", url: `${APP_URL}/organizer` }],
          [{ text: "◀️ Back to Menu", callback_data: "main_menu" }],
        ],
      },
    }, lovableKey, telegramKey);
    return;
  }
  if (data.startsWith("org_broadcast:")) {
    const eventId = data.split(":")[1];
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "📢 Send announcements from your dashboard:",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔗 Open Telegram Dashboard", url: `${APP_URL}/organizer` }],
          [{ text: "◀️ Back to Menu", callback_data: "main_menu" }],
        ],
      },
    }, lovableKey, telegramKey);
    return;
  }

  // ─── MAIN MENU ───
  if (data === "main_menu") {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "📌 *VERS Assistant Menu*",
      parse_mode: "Markdown",
      reply_markup: menu,
    }, lovableKey, telegramKey);
    return;
  }
}

// ─── Handler: My Events (Explorer) ──────────────────────────────
async function handleMyEvents(
  chatId: number,
  account: TelegramAccount,
  supabase: ReturnType<typeof createClient>,
  lovableKey: string,
  telegramKey: string
) {
  const userEmails = await getRegistrationEmails(chatId, account.user_id, supabase);

  let registrations: any[] = [];
  if (userEmails.length > 0) {
    const { data } = await supabase
      .from("registrations")
      .select("event_id, ticket_id, status, source, event_slug, events(id, title, slug, date, time, location, is_published)")
      .in("email", userEmails)
      .in("status", ATTENDEE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) registrations = data;
  }

  const { data: savedEvents } = await supabase
    .from("saved_events")
    .select("event_id, events!inner(id, title, slug, date, location)")
    .eq("user_id", account.user_id)
    .order("created_at", { ascending: false })
    .limit(10);

  const buttons: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];
  let text = "📋 *Your Events*\n\n";

  // De-duplicate by event id
  const seenEventIds = new Set<string>();

  if (registrations && registrations.length > 0) {
    text += "✅ *Registered Events:*\n";
    for (const reg of registrations) {
      const event = (reg as any).events;
      if (event && !seenEventIds.has(event.id)) {
        seenEventIds.add(event.id);
        text += `• ${event.title}\n`;
        buttons.push([
          { text: `📌 ${event.title}`, callback_data: `event_details:${event.id}` },
        ]);
      }
    }
    text += "\n";
  }

  if (savedEvents && savedEvents.length > 0) {
    text += "🔖 *Saved Events:*\n";
    for (const saved of savedEvents) {
      const event = (saved as any).events;
      if (event && !seenEventIds.has(event.id)) {
        seenEventIds.add(event.id);
        text += `• ${event.title}\n`;
        buttons.push([
          { text: `🔖 ${event.title}`, callback_data: `event_details:${event.id}` },
        ]);
      }
    }
  }

  if (seenEventIds.size === 0) {
    text = "📋 *Your Events*\n\nYou don't have any events yet.\n\nExplore events on VERS to get started!";
  }

  buttons.push([{ text: "🔍 Explore Events", url: `${APP_URL}/events` }]);
  buttons.push([{ text: "◀️ Back to Menu", callback_data: "main_menu" }]);

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: buttons },
  }, lovableKey, telegramKey);
}

// ─── Handler: Organizer My Events ────────────────────────────────
async function handleOrgMyEvents(
  chatId: number,
  account: TelegramAccount,
  supabase: ReturnType<typeof createClient>,
  lovableKey: string,
  telegramKey: string
) {
  const { data: events } = await supabase
    .from("events")
    .select("id, title, slug, date, location")
    .eq("organizer_id", account.user_id)
    .order("date", { ascending: false })
    .limit(10);

  if (!events || events.length === 0) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "📋 You haven't created any events yet.",
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Create Event", callback_data: "org_create_event" }],
          [{ text: "◀️ Back to Menu", callback_data: "main_menu" }],
        ],
      },
    }, lovableKey, telegramKey);
    return;
  }

  let text = "📋 *Your Events*\n\n";
  const buttons: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

  for (const event of events) {
    text += `• *${event.title}*\n  📅 ${event.date} · 📍 ${event.location}\n\n`;
    buttons.push([
      { text: `📊 ${event.title}`, callback_data: `org_event_regs:${event.id}` },
    ]);
  }

  buttons.push([{ text: "◀️ Back to Menu", callback_data: "main_menu" }]);

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: buttons },
  }, lovableKey, telegramKey);
}

// ─── Handler: Organizer Registrations ────────────────────────────
async function handleOrgRegistrations(
  chatId: number,
  account: TelegramAccount,
  supabase: ReturnType<typeof createClient>,
  lovableKey: string,
  telegramKey: string
) {
  const { data: events } = await supabase
    .from("events")
    .select("id, title")
    .eq("organizer_id", account.user_id)
    .order("date", { ascending: false })
    .limit(10);

  if (!events || events.length === 0) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "No events found.",
      reply_markup: { inline_keyboard: [[{ text: "◀️ Back to Menu", callback_data: "main_menu" }]] },
    }, lovableKey, telegramKey);
    return;
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  for (const event of events) {
    buttons.push([{ text: `📝 ${event.title}`, callback_data: `org_event_regs:${event.id}` }]);
  }
  buttons.push([{ text: "◀️ Back to Menu", callback_data: "main_menu" }]);

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: "📝 *Registrations*\n\nSelect an event to view registrations:",
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: buttons },
  }, lovableKey, telegramKey);
}

// ─── Handler: Organizer Event Registrations ──────────────────────
async function handleOrgEventRegistrations(
  chatId: number,
  eventId: string,
  account: TelegramAccount,
  supabase: ReturnType<typeof createClient>,
  lovableKey: string,
  telegramKey: string
) {
  const { data: event } = await supabase
    .from("events")
    .select("title, slug")
    .eq("id", eventId)
    .eq("organizer_id", account.user_id)
    .single();

  if (!event) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "Event not found.",
      reply_markup: { inline_keyboard: [[{ text: "◀️ Back to Menu", callback_data: "main_menu" }]] },
    }, lovableKey, telegramKey);
    return;
  }

  const { count: totalCount } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  const { count: approvedCount } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "approved");

  const { count: pendingCount } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "pending");

  const { count: checkedInCount } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("checked_in", true);

  const text = `📝 *${event.title}*\n\n📊 Registration Stats:\n• Total: ${totalCount || 0}\n• Approved: ${approvedCount || 0}\n• Pending: ${pendingCount || 0}\n• Checked In: ${checkedInCount || 0}`;

  const buttons: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];
  if ((pendingCount || 0) > 0) {
    buttons.push([{ text: `✅ Approve Pending (${pendingCount})`, callback_data: `org_approve_pending:${eventId}` }]);
  }
  buttons.push([{ text: "📢 Send Update", callback_data: `org_broadcast:${eventId}` }]);
  buttons.push([{ text: "🔗 Open Dashboard", url: `${APP_URL}/organizer` }]);
  buttons.push([{ text: "◀️ Back to Menu", callback_data: "main_menu" }]);

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: buttons },
  }, lovableKey, telegramKey);
}

// ─── Handler: Organizer Payments ─────────────────────────────────
async function handleOrgPayments(
  chatId: number,
  account: TelegramAccount,
  supabase: ReturnType<typeof createClient>,
  lovableKey: string,
  telegramKey: string
) {
  const { data: events } = await supabase
    .from("events")
    .select("id, title")
    .eq("organizer_id", account.user_id)
    .order("date", { ascending: false })
    .limit(5);

  if (!events || events.length === 0) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "No events found.",
      reply_markup: { inline_keyboard: [[{ text: "◀️ Back to Menu", callback_data: "main_menu" }]] },
    }, lovableKey, telegramKey);
    return;
  }

  let text = "💰 *Payment Summary*\n\n";

  for (const event of events) {
    const { count: pending } = await supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("status", "pending");

    const { count: approved } = await supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("status", "approved");

    text += `📌 *${event.title}*\n  ✅ Approved: ${approved || 0} | ⏳ Pending: ${pending || 0}\n\n`;
  }

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔗 Open Dashboard", url: `${APP_URL}/organizer` }],
        [{ text: "◀️ Back to Menu", callback_data: "main_menu" }],
      ],
    },
  }, lovableKey, telegramKey);
}

// ─── Handler: Organizer Analytics ────────────────────────────────
async function handleOrgAnalytics(
  chatId: number,
  account: TelegramAccount,
  supabase: ReturnType<typeof createClient>,
  lovableKey: string,
  telegramKey: string
) {
  const { data: events } = await supabase
    .from("events")
    .select("id, title")
    .eq("organizer_id", account.user_id)
    .order("date", { ascending: false })
    .limit(5);

  if (!events || events.length === 0) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "No events found.",
      reply_markup: { inline_keyboard: [[{ text: "◀️ Back to Menu", callback_data: "main_menu" }]] },
    }, lovableKey, telegramKey);
    return;
  }

  let text = "📊 *Event Analytics*\n\n";

  for (const event of events) {
    const { count: regCount } = await supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("status", "approved");

    const { count: viewCount } = await supabase
      .from("event_views")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id);

    const convRate = (viewCount || 0) > 0 ? Math.round(((regCount || 0) / (viewCount || 1)) * 100) : 0;

    text += `📌 *${event.title}*\n  👀 Views: ${viewCount || 0} | 📝 Registrations: ${regCount || 0} | 📈 Conv: ${convRate}%\n\n`;
  }

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔗 Full Analytics", url: `${APP_URL}/organizer` }],
        [{ text: "◀️ Back to Menu", callback_data: "main_menu" }],
      ],
    },
  }, lovableKey, telegramKey);
}

// ─── Handler: Event Details ──────────────────────────────────────
async function handleEventDetails(
  chatId: number,
  eventId: string,
  account: TelegramAccount,
  supabase: ReturnType<typeof createClient>,
  lovableKey: string,
  telegramKey: string
) {
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (!event) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "Event not found.",
      reply_markup: { inline_keyboard: [[{ text: "◀️ Back to Menu", callback_data: "main_menu" }]] },
    }, lovableKey, telegramKey);
    return;
  }

  let organizerName = "VERS Events";
  if (event.organizer_id) {
    const { data: org } = await supabase
      .from("organizer_profiles")
      .select("organization_name")
      .eq("user_id", event.organizer_id)
      .single();
    if (org) organizerName = org.organization_name;
  }

  const userEmails = await getRegistrationEmails(chatId, account.user_id, supabase);

  let registration: any = null;
  if (userEmails.length > 0) {
    const { data } = await supabase
      .from("registrations")
      .select("id, ticket_id, status")
      .eq("event_id", eventId)
      .in("email", userEmails)
      .in("status", ATTENDEE_STATUSES)
      .limit(1)
      .single();
    registration = data;
  }

  const isRegistered = !!registration;

  let text = `📌 *${event.title}*\n`;
  text += `🏢 Organizer: ${organizerName}\n`;
  text += `📅 Date: ${event.date}\n`;
  text += `🕐 Time: ${event.time}\n`;
  text += `📍 Location: ${event.location}\n`;
  if (event.duration) text += `⏱ Duration: ${event.duration}\n`;
  text += `🏷 Category: ${event.category}\n`;
  text += `💰 Ticket: ${event.ticket_price}\n`;

  if (event.is_postponed) {
    text += `\n⚠️ *This event has been postponed*`;
    if (event.postponed_date) text += `\n📅 New Date: ${event.postponed_date}`;
    if (event.postponed_location) text += `\n📍 New Location: ${event.postponed_location}`;
    text += "\n";
  }

  if (event.about) {
    text += `\n📝 *About:*\n${event.about.substring(0, 300)}`;
    if (event.about.length > 300) text += "...";
    text += "\n";
  }

  // Include speakers/guests/MCs from event.speakers JSON
  if (event.speakers) {
    try {
      const participants = typeof event.speakers === "string" ? JSON.parse(event.speakers) : event.speakers;
      if (Array.isArray(participants) && participants.length > 0) {
        const grouped: Record<string, any[]> = {};
        for (const p of participants) {
          const role = p.role || "Speaker";
          if (!grouped[role]) grouped[role] = [];
          grouped[role].push(p);
        }
        for (const [role, people] of Object.entries(grouped)) {
          const emoji = role === "MC / Host" ? "🎤" : role === "Special Guest" ? "⭐" : "🎙";
          text += `\n${emoji} *${role}s:*\n`;
          for (const p of people) {
            text += `  • *${p.name}*`;
            if (p.title) text += ` — ${p.title}`;
            text += "\n";
            if (p.bio) text += `    _${p.bio.substring(0, 100)}${p.bio.length > 100 ? "..." : ""}_\n`;
          }
        }
      }
    } catch { /* ignore parse errors */ }
  }

  // Include partners
  if (event.partners && Array.isArray(event.partners) && event.partners.length > 0) {
    text += `\n🤝 *Partners:* ${event.partners.join(", ")}\n`;
  }

  // What to expect
  if (event.what_to_expect && Array.isArray(event.what_to_expect) && event.what_to_expect.length > 0) {
    text += `\n✨ *What to Expect:*\n`;
    for (const item of event.what_to_expect.slice(0, 5)) {
      text += `  • ${item}\n`;
    }
  }

  const buttons: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

  if (isRegistered) {
    buttons.push([{ text: "🎟 Get Ticket", callback_data: `get_ticket:${eventId}` }]);
  } else {
    buttons.push([{ text: "📝 Register", callback_data: `register:${event.slug}` }]);
  }

  buttons.push([{ text: "🔗 Open Event Page", url: `${APP_URL}/event/${event.slug}` }]);

  const eventDate = new Date(event.date);
  if (eventDate < new Date() && isRegistered) {
    buttons.push([{ text: "📝 Leave Feedback", callback_data: `feedback:${eventId}` }]);
  }

  buttons.push([{ text: "◀️ Back to My Events", callback_data: "my_events" }]);
  buttons.push([{ text: "◀️ Main Menu", callback_data: "main_menu" }]);

  // If event has an image, send it as a photo with the text as caption
  if (event.image_url) {
    // Telegram captions max 1024 chars
    const captionText = text.length > 1024 ? text.substring(0, 1020) + "..." : text;
    await telegramApi("sendPhoto", {
      chat_id: chatId,
      photo: event.image_url,
      caption: captionText,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons },
    }, lovableKey, telegramKey);
  } else {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons },
    }, lovableKey, telegramKey);
  }

  // Send speaker photos if available
  if (event.speakers) {
    try {
      const participants = typeof event.speakers === "string" ? JSON.parse(event.speakers) : event.speakers;
      if (Array.isArray(participants)) {
        const withPhotos = participants.filter((p: any) => p.photo);
        if (withPhotos.length > 0 && withPhotos.length <= 10) {
          const media = withPhotos.map((p: any, idx: number) => ({
            type: "photo",
            media: p.photo,
            ...(idx === 0 ? { caption: `🎙 *Event Participants*` , parse_mode: "Markdown" } : {}),
          }));
          if (media.length === 1) {
            await telegramApi("sendPhoto", {
              chat_id: chatId,
              photo: withPhotos[0].photo,
              caption: `🎙 *${withPhotos[0].name}*${withPhotos[0].title ? ` — ${withPhotos[0].title}` : ""}`,
              parse_mode: "Markdown",
            }, lovableKey, telegramKey);
          } else {
            await telegramApi("sendMediaGroup", {
              chat_id: chatId,
              media,
            }, lovableKey, telegramKey);
          }
        }
      }
    } catch { /* ignore */ }
  }
}
async function handleGetTicket(
  chatId: number,
  eventId: string,
  account: TelegramAccount,
  supabase: ReturnType<typeof createClient>,
  lovableKey: string,
  telegramKey: string
) {
  const userEmails = await getRegistrationEmails(chatId, account.user_id, supabase);

  const { data: event } = await supabase
    .from("events")
    .select("title, slug, ticket_price, payment_info, accepted_payment_methods")
    .eq("id", eventId)
    .single();

  if (!event) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "Event not found.",
      reply_markup: { inline_keyboard: [[{ text: "◀️ Back to Menu", callback_data: "main_menu" }]] },
    }, lovableKey, telegramKey);
    return;
  }

  let registration: any = null;
  if (userEmails.length > 0) {
    const { data } = await supabase
      .from("registrations")
      .select("ticket_id, status")
      .eq("event_id", eventId)
      .in("email", userEmails)
      .limit(1)
      .single();
    registration = data;
  }

  if (registration && registration.status === "approved") {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: `🎟 *Your Ticket*\n\n📌 Event: ${event.title}\n🎫 Ticket ID: \`${registration.ticket_id}\`\n\nShow this ticket ID at the entrance. Your full QR ticket is available on the event page.`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔗 View Event Page", url: `${APP_URL}/event/${event.slug}` }],
          [{ text: "◀️ Back to Menu", callback_data: "main_menu" }],
        ],
      },
    }, lovableKey, telegramKey);
    return;
  }

  if (registration && registration.status === "pending") {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: `⏳ Your registration for *${event.title}* is pending approval.`,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "◀️ Back to Menu", callback_data: "main_menu" }]] },
    }, lovableKey, telegramKey);
    return;
  }

  const isFree = !event.ticket_price || event.ticket_price === "Free" || event.ticket_price === "0";
  if (isFree) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: `🎟 *${event.title}*\n\nThis is a free event! Register to get your ticket.`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📝 Register Now", url: `${APP_URL}/event/${event.slug}` }],
          [{ text: "◀️ Back to Menu", callback_data: "main_menu" }],
        ],
      },
    }, lovableKey, telegramKey);
  } else {
    const methods = event.accepted_payment_methods || ["bank_transfer"];
    const labels: Record<string, string> = { bank_transfer: "🏦 Bank Transfer", telebirr: "📱 Telebirr", mpessa: "📱 M-Pesa" };
    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
    for (const m of methods) {
      buttons.push([{ text: labels[m] || m, callback_data: `pay_method:${eventId}:${m}` }]);
    }
    buttons.push([{ text: "◀️ Back to Menu", callback_data: "main_menu" }]);
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: `🎟 *${event.title}*\n💰 Price: ${event.ticket_price}\n\nSelect a payment method:`,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons },
    }, lovableKey, telegramKey);
  }
}

// ─── Handler: Payment Method ─────────────────────────────────────
async function handlePaymentMethod(
  chatId: number,
  eventId: string,
  method: string,
  account: TelegramAccount,
  supabase: ReturnType<typeof createClient>,
  lovableKey: string,
  telegramKey: string
) {
  const { data: event } = await supabase
    .from("events")
    .select("title, slug, ticket_price, payment_info, payment_instructions")
    .eq("id", eventId)
    .single();

  if (!event) return;

  let paymentDetails = "";
  if (event.payment_info) {
    try {
      const info = typeof event.payment_info === "string" ? JSON.parse(event.payment_info) : event.payment_info;
      if (method === "bank_transfer" && info.bankTransfer) {
        for (const bank of info.bankTransfer) {
          paymentDetails += `\n🏦 ${bank.bank || "Bank"}\n   Account: ${bank.accountNumber || "N/A"}\n   Name: ${bank.accountName || "N/A"}\n`;
        }
      } else if (method === "telebirr" && info.telebirr) {
        paymentDetails += `\n📱 Telebirr\n   Name: ${info.telebirr.name || "N/A"}\n   Phone: ${info.telebirr.phone || "N/A"}\n`;
      } else if (method === "mpessa" && info.mpessa) {
        paymentDetails += `\n📱 M-Pesa\n   Name: ${info.mpessa.name || "N/A"}\n   Phone: ${info.mpessa.phone || "N/A"}\n`;
      }
    } catch { /* ignore */ }
  }

  let text = `💳 *Payment Details*\n\n📌 Event: ${event.title}\n💰 Amount: ${event.ticket_price}\n`;
  text += paymentDetails;
  if (event.payment_instructions) text += `\n📝 Instructions: ${event.payment_instructions}\n`;
  text += `\nAfter paying, complete registration on the event page.`;

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📝 Complete Registration", url: `${APP_URL}/event/${event.slug}` }],
        [{ text: "◀️ Back to Menu", callback_data: "main_menu" }],
      ],
    },
  }, lovableKey, telegramKey);
}

// ─── Handler: Get Ticket Menu ────────────────────────────────────
async function handleGetTicketMenu(
  chatId: number,
  account: TelegramAccount,
  supabase: ReturnType<typeof createClient>,
  lovableKey: string,
  telegramKey: string
) {
  const userEmails = await getRegistrationEmails(chatId, account.user_id, supabase);

  let registrations: any[] = [];
  if (userEmails.length > 0) {
    const { data } = await supabase
      .from("registrations")
      .select("event_id, ticket_id, status, events!inner(id, title, slug)")
      .in("email", userEmails)
      .in("status", ATTENDEE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) registrations = data;
  }

  if (!registrations || registrations.length === 0) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "🎟 You don't have any tickets yet.\n\nRegister for an event to get your ticket!",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔗 Browse Events", url: `${APP_URL}/events` }],
          [{ text: "◀️ Back to Menu", callback_data: "main_menu" }],
        ],
      },
    }, lovableKey, telegramKey);
    return;
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  let text = "🎟 *Your Tickets*\n\nSelect an event:\n\n";

  for (const reg of registrations) {
    const event = (reg as any).events;
    if (event) {
      const label = reg.status === "pending" ? "pending approval" : reg.ticket_id;
      text += `• ${event.title} — \`${label}\`\n`;
      buttons.push([{ text: `🎫 ${event.title}`, callback_data: `get_ticket:${event.id}` }]);
    }
  }

  buttons.push([{ text: "◀️ Back to Menu", callback_data: "main_menu" }]);

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: buttons },
  }, lovableKey, telegramKey);
}

// ─── Handler: Updates ────────────────────────────────────────────
async function handleUpdates(
  chatId: number,
  account: TelegramAccount,
  supabase: ReturnType<typeof createClient>,
  lovableKey: string,
  telegramKey: string
) {
  const updatesStatus = account.telegram_updates_enabled ? "✅ ON" : "❌ OFF";
  const userEmails = await getRegistrationEmails(chatId, account.user_id, supabase);

  let regs: any[] = [];
  if (userEmails.length > 0) {
    const { data } = await supabase
      .from("registrations")
      .select("event_id")
      .in("email", userEmails)
      .in("status", ATTENDEE_STATUSES);
    if (data) regs = data;
  }

  const { data: saved } = await supabase
    .from("saved_events")
    .select("event_id")
    .eq("user_id", account.user_id);

  const allEventIds = [...new Set([...(regs || []).map((r) => r.event_id), ...(saved || []).map((s) => s.event_id)])];

  let text = `📢 *Updates*\n\nStatus: ${updatesStatus}\n\n`;

  if (allEventIds.length > 0) {
    const { data: announcements } = await supabase
      .from("telegram_announcements")
      .select("message, created_at, events!inner(title)")
      .in("event_id", allEventIds)
      .order("created_at", { ascending: false })
      .limit(5);

    if (announcements && announcements.length > 0) {
      text += "*Recent announcements:*\n\n";
      for (const ann of announcements) {
        const event = (ann as any).events;
        const date = new Date(ann.created_at).toLocaleDateString();
        text += `📌 *${event?.title || "Event"}* (${date})\n${ann.message.substring(0, 200)}\n\n`;
      }
    } else {
      text += "No recent announcements.";
    }
  } else {
    text += "Register for events to receive updates.";
  }

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: account.telegram_updates_enabled ? "🔕 Disable Updates" : "🔔 Enable Updates", callback_data: "toggle_updates" }],
        [{ text: "◀️ Back to Menu", callback_data: "main_menu" }],
      ],
    },
  }, lovableKey, telegramKey);
}

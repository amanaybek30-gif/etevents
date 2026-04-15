import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ATTENDEE_STATUSES = ["approved", "pending"];

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

  try {
    const body = await req.json();
    const { action, chat_id, user_id, event_id, message, reply_markup, parse_mode, photo_urls, info_buttons } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const tgHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    };

    // ─── Helper: escape Markdown special chars for safe sending ───
    function escapeMarkdown(text: string): string {
      // Only escape in non-bold/italic sections - replace common problematic chars
      return text
        .replace(/(?<!\*)\*(?!\*)/g, '\\*')  // lone asterisks
        .replace(/(?<!_)_(?!_)/g, '\\_');     // lone underscores
    }

    // ─── Helper: send with fallback (try Markdown, fallback to plain text) ───
    async function safeSend(chatId: number, text: string, replyMarkup?: unknown): Promise<boolean> {
      const payload: Record<string, unknown> = {
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      };

      let res = await fetch(`${GATEWAY_URL}/sendMessage`, {
        method: "POST",
        headers: tgHeaders,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`Markdown send failed for chat ${chatId}:`, errBody);

        delete payload.parse_mode;
        res = await fetch(`${GATEWAY_URL}/sendMessage`, {
          method: "POST",
          headers: tgHeaders,
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errBody2 = await res.text();
          console.error(`Plain send also failed for chat ${chatId}:`, errBody2);
          return false;
        }
      }
      await res.text();
      return true;
    }

    // ─── Helper: send photo(s) with caption, with Markdown fallback ───
    async function safeSendPhotos(chatId: number, photoUrls: string[], caption: string, replyMarkup?: unknown): Promise<boolean> {
      if (photoUrls.length === 1) {
        let res = await fetch(`${GATEWAY_URL}/sendPhoto`, {
          method: "POST", headers: tgHeaders,
          body: JSON.stringify({ chat_id: chatId, photo: photoUrls[0], caption, parse_mode: "Markdown", ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }),
        });
        if (!res.ok) {
          const err = await res.text();
          console.error(`Photo Markdown failed for ${chatId}:`, err);
          res = await fetch(`${GATEWAY_URL}/sendPhoto`, {
            method: "POST", headers: tgHeaders,
            body: JSON.stringify({ chat_id: chatId, photo: photoUrls[0], caption, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }),
          });
          if (!res.ok) { await res.text(); return false; }
        }
        await res.text();
        return true;
      }

      // Multiple photos - sendMediaGroup
      const media = photoUrls.map((url: string, idx: number) => ({
        type: "photo", media: url,
        ...(idx === 0 && caption ? { caption, parse_mode: "Markdown" } : {}),
      }));
      let res = await fetch(`${GATEWAY_URL}/sendMediaGroup`, {
        method: "POST", headers: tgHeaders,
        body: JSON.stringify({ chat_id: chatId, media }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error(`MediaGroup Markdown failed for ${chatId}:`, err);
        // Retry without parse_mode
        const mediaPlain = photoUrls.map((url: string, idx: number) => ({
          type: "photo", media: url,
          ...(idx === 0 && caption ? { caption } : {}),
        }));
        res = await fetch(`${GATEWAY_URL}/sendMediaGroup`, {
          method: "POST", headers: tgHeaders,
          body: JSON.stringify({ chat_id: chatId, media: mediaPlain }),
        });
        if (!res.ok) { await res.text(); return false; }
      }
      await res.text();

      // Send buttons in a separate message after media group
      if (replyMarkup) {
        await safeSend(chatId, "👆 Tap a button below:", replyMarkup);
      }
      return true;
    }

    // ─── Helper: send content (text or photos) to a chat ───
    async function safeSendContent(chatId: number, text: string, photoUrls?: string[], replyMarkup?: unknown): Promise<boolean> {
      if (photoUrls && photoUrls.length > 0) {
        return safeSendPhotos(chatId, photoUrls, text, replyMarkup);
      }
      return safeSend(chatId, text, replyMarkup);
    }

    // ─── Send to specific chat ───
    if (action === "send_message" && chat_id && message) {
      const ok = await safeSend(chat_id, message, reply_markup);
      return new Response(JSON.stringify({ ok }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Send to user by user_id ───
    if (action === "send_to_user" && user_id && message) {
      const { data: account } = await supabase
        .from("telegram_accounts")
        .select("telegram_chat_id, telegram_updates_enabled")
        .eq("user_id", user_id)
        .single();

      if (!account || !account.telegram_chat_id) {
        return new Response(JSON.stringify({ ok: false, error: "User not connected to Telegram" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!account.telegram_updates_enabled) {
        return new Response(JSON.stringify({ ok: false, error: "User has updates disabled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ok = await safeSend(account.telegram_chat_id, message, reply_markup);
      return new Response(JSON.stringify({ ok }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Helper: collect broadcast chat IDs ───
    // Now checks BOTH attendee_accounts AND organizer_profiles for email matching
    async function collectBroadcastChatIds(eventId: string): Promise<Set<number>> {
      // Get all registration emails for this event (includes imported attendees)
      const { data: regs } = await supabase
        .from("registrations")
        .select("email")
        .eq("event_id", eventId)
        .in("status", ATTENDEE_STATUSES);

      const emails = [...new Set((regs || []).map((r: any) => r.email.toLowerCase()))];

      // Get saved-event user_ids
      const { data: savedUsers } = await supabase
        .from("saved_events")
        .select("user_id")
        .eq("event_id", eventId);

      const savedUserIds = [...new Set((savedUsers || []).map((s: any) => s.user_id))];

      // Get ALL linked telegram accounts in one query
      const { data: allTg } = await supabase
        .from("telegram_accounts")
        .select("user_id, telegram_chat_id, telegram_updates_enabled")
        .not("telegram_chat_id", "is", null)
        .not("linked_at", "is", null);

      if (!allTg || allTg.length === 0) return new Set();

      const tgUserIds = allTg.map(t => t.user_id);
      const userIdToChatInfo = new Map<string, { chatId: number; updatesEnabled: boolean }>();
      allTg.forEach(t => {
        if (t.telegram_chat_id) {
          userIdToChatInfo.set(t.user_id, {
            chatId: t.telegram_chat_id,
            updatesEnabled: t.telegram_updates_enabled,
          });
        }
      });

      // Build email→user_id map from ALL sources
      const emailToUserId = new Map<string, string>();

      // 1. Attendee accounts
      const { data: attendeeAccs } = await supabase
        .from("attendee_accounts")
        .select("user_id, email")
        .in("user_id", tgUserIds);
      attendeeAccs?.forEach(a => {
        if (a.email) emailToUserId.set(a.email.toLowerCase(), a.user_id);
      });

      // 2. Organizer profiles
      const { data: orgAccs } = await supabase
        .from("organizer_profiles")
        .select("user_id, email")
        .in("user_id", tgUserIds);
      orgAccs?.forEach(o => {
        if (o.email) emailToUserId.set(o.email.toLowerCase(), o.user_id);
      });

      // 3. Auth users (catches imported attendees and anyone not in attendee_accounts/organizer_profiles)
      const unmatchedUserIds = tgUserIds.filter(uid => {
        const hasEmail = [...emailToUserId.values()].includes(uid);
        return !hasEmail;
      });
      for (const uid of unmatchedUserIds) {
        try {
          const { data: authData } = await supabase.auth.admin.getUserById(uid);
          if (authData?.user?.email) {
            emailToUserId.set(authData.user.email.toLowerCase(), uid);
          }
        } catch { /* skip */ }
      }

      const chatIds = new Set<number>();

      // Match registration emails to telegram accounts
      for (const email of emails) {
        const uid = emailToUserId.get(email);
        if (uid) {
          const info = userIdToChatInfo.get(uid);
          if (info && info.updatesEnabled) {
            chatIds.add(info.chatId);
          }
        }
      }

      // Also include saved-event users
      for (const uid of savedUserIds) {
        const info = userIdToChatInfo.get(uid);
        if (info && info.updatesEnabled) {
          chatIds.add(info.chatId);
        }
      }

      return chatIds;
    }

    // ─── Helper: save announcement record ───
    async function saveAnnouncement(eventId: string, msg: string, sentCount: number) {
      const authHeader = req.headers.get("Authorization");
      let organizerId = null;
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: claims } = await userClient.auth.getUser(token);
        if (claims?.user) organizerId = claims.user.id;
      }

      if (organizerId) {
        await supabase.from("telegram_announcements").insert({
          event_id: eventId,
          organizer_id: organizerId,
          message: msg,
          sent_count: sentCount,
        });
      }
    }

    // ─── Store info button data for callback handling ───
    async function storeInfoButtons(_eventId: string, infoButtonsData: Array<{ key?: string; text: string; message: string }>) {
      if (!infoButtonsData || infoButtonsData.length === 0) return;
      for (const btn of infoButtonsData) {
        const key = btn.key || `tg_info_btn:${btn.message.slice(0, 60)}`;
        await supabase.from("platform_settings").upsert(
          { key: `tg_btn:${key}`, value: btn.message },
          { onConflict: "key" }
        );
      }
    }

    // ─── Broadcast to ALL connected users ───
    if ((action === "broadcast_all" || action === "broadcast_all_photos") && message) {
      const { data: allTg } = await supabase
        .from("telegram_accounts")
        .select("telegram_chat_id, telegram_updates_enabled")
        .not("telegram_chat_id", "is", null)
        .not("linked_at", "is", null);

      const chatIds = new Set<number>();
      (allTg || []).forEach(t => {
        if (t.telegram_chat_id && t.telegram_updates_enabled) chatIds.add(t.telegram_chat_id);
      });

      if (info_buttons) await storeInfoButtons("all_users", info_buttons);

      let sent = 0;
      let failed = 0;
      const urls = (action === "broadcast_all_photos" && photo_urls && Array.isArray(photo_urls)) ? photo_urls : undefined;
      for (const cid of chatIds) {
        try {
          const ok = await safeSendContent(cid, message, urls, reply_markup);
          if (ok) sent++; else failed++;
        } catch { failed++; }
        await new Promise((r) => setTimeout(r, 50));
      }

      return new Response(JSON.stringify({ ok: true, sent, failed, total: chatIds.size }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Broadcast text to event attendees ───
    if (action === "broadcast" && event_id && message) {
      const chatIds = await collectBroadcastChatIds(event_id);
      if (info_buttons) await storeInfoButtons(event_id, info_buttons);

      let sent = 0;
      let failed = 0;
      for (const cid of chatIds) {
        try {
          const ok = await safeSendContent(cid, message, undefined, reply_markup);
          if (ok) sent++; else failed++;
        } catch { failed++; }
        await new Promise((r) => setTimeout(r, 50));
      }

      await saveAnnouncement(event_id, message, sent);
      return new Response(JSON.stringify({ ok: true, sent, failed, total: chatIds.size }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── Broadcast photos with caption to event attendees ───
    if (action === "broadcast_photos" && event_id && photo_urls && Array.isArray(photo_urls)) {
      const chatIds = await collectBroadcastChatIds(event_id);
      const caption = message || "";
      if (info_buttons) await storeInfoButtons(event_id, info_buttons);

      let sent = 0;
      let failed = 0;
      for (const cid of chatIds) {
        try {
          const ok = await safeSendContent(cid, caption, photo_urls, reply_markup);
          if (ok) sent++; else failed++;
        } catch { failed++; }
        await new Promise((r) => setTimeout(r, 50));
      }

      await saveAnnouncement(event_id, `[${photo_urls.length} photo(s)] ${caption}`, sent);
      return new Response(JSON.stringify({ ok: true, sent, failed, total: chatIds.size }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── Broadcast to imported attendees only ───
    if (action === "broadcast_imported" && event_id && message) {
      const { data: regs } = await supabase
        .from("registrations")
        .select("email")
        .eq("event_id", event_id)
        .eq("source", "imported")
        .in("status", ATTENDEE_STATUSES);

      const emails = [...new Set((regs || []).map((r: any) => r.email.toLowerCase()))];

      const { data: allTg } = await supabase
        .from("telegram_accounts")
        .select("user_id, telegram_chat_id, telegram_updates_enabled")
        .not("telegram_chat_id", "is", null)
        .not("linked_at", "is", null);

      if (!allTg || allTg.length === 0 || emails.length === 0) {
        return new Response(JSON.stringify({ ok: true, sent: 0, failed: 0, total: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const tgUserIds = allTg.map(t => t.user_id);
      const userIdToChatInfo = new Map();
      allTg.forEach(t => {
        if (t.telegram_chat_id) userIdToChatInfo.set(t.user_id, { chatId: t.telegram_chat_id, updatesEnabled: t.telegram_updates_enabled });
      });

      const emailToUserId = new Map<string, string>();
      const { data: attendeeAccs } = await supabase.from("attendee_accounts").select("user_id, email").in("user_id", tgUserIds);
      attendeeAccs?.forEach(a => { if (a.email) emailToUserId.set(a.email.toLowerCase(), a.user_id); });
      const { data: orgAccs } = await supabase.from("organizer_profiles").select("user_id, email").in("user_id", tgUserIds);
      orgAccs?.forEach(o => { if (o.email) emailToUserId.set(o.email.toLowerCase(), o.user_id); });
      const unmatchedUserIds = tgUserIds.filter(uid => ![...emailToUserId.values()].includes(uid));
      for (const uid of unmatchedUserIds) {
        try {
          const { data: authData } = await supabase.auth.admin.getUserById(uid);
          if (authData?.user?.email) emailToUserId.set(authData.user.email.toLowerCase(), uid);
        } catch { /* skip */ }
      }

      const chatIds = new Set<number>();
      for (const email of emails) {
        const uid = emailToUserId.get(email);
        if (uid) {
          const info = userIdToChatInfo.get(uid);
          if (info && info.updatesEnabled) chatIds.add(info.chatId);
        }
      }

      if (info_buttons) await storeInfoButtons(event_id, info_buttons);

      let sent = 0;
      let failed = 0;
      const urls = (photo_urls && Array.isArray(photo_urls) && photo_urls.length > 0) ? photo_urls : undefined;
      for (const cid of chatIds) {
        try {
          const ok = await safeSendContent(cid, message, urls, reply_markup);
          if (ok) sent++; else failed++;
        } catch { failed++; }
        await new Promise((r) => setTimeout(r, 50));
      }

      await saveAnnouncement(event_id, `[imported] ${message}`, sent);
      return new Response(JSON.stringify({ ok: true, sent, failed, total: chatIds.size }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── Broadcast to organizers only ───
    if (action === "broadcast_organizers" && message) {
      const { data: allTg } = await supabase
        .from("telegram_accounts")
        .select("user_id, telegram_chat_id, telegram_updates_enabled")
        .not("telegram_chat_id", "is", null)
        .not("linked_at", "is", null);

      if (!allTg || allTg.length === 0) {
        return new Response(JSON.stringify({ ok: true, sent: 0, failed: 0, total: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const tgUserIds = allTg.map(t => t.user_id);
      const userIdToChatInfo = new Map();
      allTg.forEach(t => {
        if (t.telegram_chat_id) userIdToChatInfo.set(t.user_id, { chatId: t.telegram_chat_id, updatesEnabled: t.telegram_updates_enabled });
      });

      const { data: orgAccs } = await supabase
        .from("organizer_profiles")
        .select("user_id")
        .in("user_id", tgUserIds);

      const chatIds = new Set<number>();
      orgAccs?.forEach(o => {
        const info = userIdToChatInfo.get(o.user_id);
        if (info && info.updatesEnabled) chatIds.add(info.chatId);
      });

      if (info_buttons) await storeInfoButtons("organizers", info_buttons);

      let sent = 0;
      let failed = 0;
      const urls = (photo_urls && Array.isArray(photo_urls) && photo_urls.length > 0) ? photo_urls : undefined;
      for (const cid of chatIds) {
        try {
          const ok = await safeSendContent(cid, message, urls, reply_markup);
          if (ok) sent++; else failed++;
        } catch { failed++; }
        await new Promise((r) => setTimeout(r, 50));
      }

      return new Response(JSON.stringify({ ok: true, sent, failed, total: chatIds.size }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("telegram-send error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

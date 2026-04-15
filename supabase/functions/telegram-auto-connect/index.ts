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
    const { userId, fullName, email, phone } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing required userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedFullName = typeof fullName === "string" ? fullName.trim() : "";
    const normalizedPhone = typeof phone === "string" ? phone.trim() : "";

    const { data: existingAccount, error: existingAccountError } = await supabase
      .from("attendee_accounts")
      .select("full_name, email, phone")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingAccountError) {
      console.error("telegram-auto-connect existing attendee_accounts lookup error:", existingAccountError);
    }

    let resolvedEmail = normalizedEmail || existingAccount?.email || "";
    let resolvedFullName = normalizedFullName || existingAccount?.full_name || "";
    let resolvedPhone = normalizedPhone || existingAccount?.phone || null;

    if (!resolvedEmail || !resolvedFullName || !resolvedPhone) {
      const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(userId);

      if (authUserError) {
        console.error("telegram-auto-connect auth lookup error:", authUserError);
      }

      const authUser = authUserData?.user;
      const authMetadata = authUser?.user_metadata ?? {};
      const metadataFullName = typeof authMetadata.full_name === "string" ? authMetadata.full_name.trim() : "";
      const metadataPhone = typeof authMetadata.phone === "string" ? authMetadata.phone.trim() : "";
      const fallbackName = (resolvedEmail || authUser?.email || "").split("@")[0]?.trim() || "Explorer";

      resolvedEmail = resolvedEmail || authUser?.email?.trim().toLowerCase() || "";
      resolvedFullName = resolvedFullName || metadataFullName || fallbackName;
      resolvedPhone = resolvedPhone || metadataPhone || null;
    }

    if (!resolvedEmail) {
      return new Response(JSON.stringify({ error: "Missing required email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: accountErr } = await supabase
      .from("attendee_accounts")
      .upsert(
        {
          user_id: userId,
          full_name: resolvedFullName,
          email: resolvedEmail,
          phone: resolvedPhone,
        },
        { onConflict: "user_id" },
      );

    if (accountErr) {
      console.error("telegram-auto-connect attendee_accounts upsert error:", accountErr);
      throw new Error("Could not save explorer profile");
    }

    const { error: roleErr } = await supabase
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "attendee" },
        { onConflict: "user_id,role" },
      );

    if (roleErr) {
      console.error("telegram-auto-connect user_roles upsert error:", roleErr);
      throw new Error("Could not assign explorer role");
    }

    const token = crypto.randomUUID().replace(/-/g, "").substring(0, 16);

    const { data: existingTelegram, error: existingTelegramError } = await supabase
      .from("telegram_accounts")
      .select("id, linked_at, telegram_chat_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingTelegramError) {
      console.error("telegram-auto-connect telegram_accounts lookup error:", existingTelegramError);
      throw new Error("Could not prepare Telegram connection");
    }

    if (existingTelegram?.linked_at || existingTelegram?.telegram_chat_id) {
      return new Response(JSON.stringify({ alreadyLinked: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingTelegram) {
      const { error: updateTelegramError } = await supabase
        .from("telegram_accounts")
        .update({
          role: "explorer",
          link_token: token,
          linked_at: null,
          telegram_chat_id: null,
          telegram_username: null,
          telegram_reminders_enabled: true,
          telegram_updates_enabled: true,
        })
        .eq("user_id", userId);

      if (updateTelegramError) {
        console.error("telegram-auto-connect telegram_accounts update error:", updateTelegramError);
        throw new Error("Could not refresh Telegram link");
      }
    } else {
      const { error: insertTelegramError } = await supabase
        .from("telegram_accounts")
        .insert({
          user_id: userId,
          role: "explorer",
          link_token: token,
          telegram_reminders_enabled: true,
          telegram_updates_enabled: true,
        });

      if (insertTelegramError) {
        console.error("telegram-auto-connect telegram_accounts insert error:", insertTelegramError);
        throw new Error("Could not create Telegram link");
      }
    }

    return new Response(JSON.stringify({ token, fullName: resolvedFullName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("telegram-auto-connect fatal error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

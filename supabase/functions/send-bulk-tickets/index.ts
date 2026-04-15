import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildConfirmAttendanceUrl, buildTelegramConnectUrl } from "../_shared/public-app-url.ts";
import { getTypeContent } from "../_shared/email-type-content.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailResult {
  email: string;
  registrationId?: string;
  success: boolean;
}

interface EmailTask {
  email: string;
  registrationId?: string;
  payload: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    reply_to?: string;
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isValidEmail = (email: string) => EMAIL_REGEX.test(email);

const normalizeString = (value: unknown, fallback = ""): string => {
  if (typeof value !== "string") return fallback;
  return value.trim();
};

const escapeHtml = (value: string) =>
  value.replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&#39;",
  }[char] || char));

const RESEND_BATCH_SIZE = 100;

const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const parseResendError = async (response: Response): Promise<string> => {
  const fallback = `Resend request failed with status ${response.status}`;

  try {
    const payload = await response.json();
    if (payload && typeof payload === "object") {
      const message =
        (payload as { error?: { message?: string } }).error?.message ??
        (payload as { error?: string }).error ??
        (payload as { message?: string }).message;

      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
  } catch {
    const text = await response.text().catch(() => "");
    if (text.trim()) return text.slice(0, 500);
  }

  return fallback;
};

async function sendBatchWithRetry(
  payloads: EmailTask["payload"][],
  apiKey: string,
  maxRetries = 5,
): Promise<{ success: boolean; errorMessage?: string }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payloads),
      });

      if (response.ok) {
        return { success: true };
      }

      const errorMessage = await parseResendError(response);
      const shouldRetry = response.status === 429 || response.status >= 500;

      if (shouldRetry && attempt < maxRetries - 1) {
        const delayMs = Math.min(1000 * 2 ** attempt, 8000);
        await sleep(delayMs);
        continue;
      }

      return { success: false, errorMessage: `HTTP ${response.status}: ${errorMessage}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === maxRetries - 1) {
        return { success: false, errorMessage: message };
      }
      await sleep(800 * (attempt + 1));
    }
  }

  return { success: false, errorMessage: "Batch email request failed" };
}

async function processEmailTasks(
  tasks: EmailTask[],
  apiKey: string,
): Promise<{ sent: number; failed: number; results: EmailResult[]; failureReason?: string }> {
  if (tasks.length === 0) {
    return { sent: 0, failed: 0, results: [] };
  }

  let sent = 0;
  let failed = 0;
  let failureReason: string | undefined;
  const results: EmailResult[] = [];

  const batches = chunkArray(tasks, RESEND_BATCH_SIZE);

  for (const batch of batches) {
    const batchSend = await sendBatchWithRetry(
      batch.map((task) => task.payload),
      apiKey,
    );

    if (batchSend.success) {
      sent += batch.length;
      results.push(...batch.map((task) => ({
        email: task.email,
        registrationId: task.registrationId,
        success: true,
      })));
      continue;
    }

    if (!failureReason && batchSend.errorMessage) {
      failureReason = batchSend.errorMessage;
    }

    for (const task of batch) {
      const singleSend = await sendBatchWithRetry([task.payload], apiKey, 3);
      const ok = singleSend.success;
      if (ok) sent += 1;
      else {
        failed += 1;
        if (!failureReason && singleSend.errorMessage) {
          failureReason = singleSend.errorMessage;
        }
      }

      results.push({
        email: task.email,
        registrationId: task.registrationId,
        success: ok,
      });
    }
  }

  return { sent, failed, results, failureReason };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase environment variables are not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      console.error("Auth failed:", claimsError?.message || "no claims");
      return new Response(JSON.stringify({ error: "Invalid JWT" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: roles, error: rolesError }, { data: organizerProfile, error: organizerProfileError }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      supabaseAdmin.from("organizer_profiles").select("id").eq("user_id", userId).maybeSingle(),
    ]);

    if (rolesError || organizerProfileError) {
      throw new Error("Failed to verify sender permissions");
    }

    const hasRolePermission = roles?.some((row: { role: string }) => ["admin", "organizer"].includes(row.role)) ?? false;
    const hasOrganizerProfile = Boolean(organizerProfile?.id);

    if (!hasRolePermission && !hasOrganizerProfile) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Custom email branch (CRM / Promote Event / Survey distribution)
    if (body.type === "custom_email") {
      const subject = normalizeString(body.subject);
      const message = normalizeString(body.message);
      const recipientsInput = Array.isArray(body.recipients) ? body.recipients : [];
      const buttons: Array<{ text: string; url: string }> = Array.isArray(body.buttons) ? body.buttons : [];
      const imageUrls: string[] = Array.isArray(body.image_urls) ? body.image_urls : [];

      if (!subject || !message) throw new Error("Subject and message are required");
      if (recipientsInput.length === 0) throw new Error("No recipients provided");
      if (recipientsInput.length > 1000) throw new Error("Maximum 1000 recipients per request");

      const uniqueRecipients = Array.from(new Map(
        recipientsInput
          .map((recipient: { email?: unknown; full_name?: unknown }) => ({
            email: normalizeString(recipient?.email).toLowerCase(),
            full_name: normalizeString(recipient?.full_name),
          }))
          .filter((recipient: { email: string; full_name: string }) => isValidEmail(recipient.email) && !recipient.email.endsWith("@self.local"))
          .map((recipient: { email: string; full_name: string }) => [recipient.email, recipient] as [string, { email: string; full_name: string }]),
      ).values());

      if (uniqueRecipients.length === 0) throw new Error("No valid recipients provided");

      const { data: orgProfileData } = await supabaseAdmin
        .from("organizer_profiles")
        .select("organization_name, email")
        .eq("user_id", userId)
        .maybeSingle();

      const orgName = normalizeString(orgProfileData?.organization_name, "VERS");
      const replyToCandidate = normalizeString(orgProfileData?.email);
      const replyTo = isValidEmail(replyToCandidate) ? replyToCandidate : undefined;

      const safeSubject = escapeHtml(subject);
      const safeMsg = escapeHtml(message).replace(/\n/g, "<br/>");
      const safeOrgName = escapeHtml(orgName);

      // Build images HTML
      let imagesHtml = "";
      if (imageUrls.length > 0) {
        imagesHtml = imageUrls.map(url =>
          `<tr><td style="padding:8px 40px;"><img src="${escapeHtml(url)}" alt="" style="width:100%;max-width:520px;border-radius:12px;display:block;" /></td></tr>`
        ).join("");
      }

      // Build buttons HTML
      let buttonsHtml = "";
      const validButtons = buttons.filter(b => b.text && b.url);
      if (validButtons.length > 0) {
        buttonsHtml = `<tr><td style="padding:16px 40px;text-align:center;">` +
          validButtons.map(b =>
            `<a href="${escapeHtml(b.url)}" target="_blank" rel="noreferrer" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#E6A817,#FFD54F);color:#0a0a0a;font-weight:700;font-size:14px;border-radius:8px;text-decoration:none;margin:4px 6px;">${escapeHtml(b.text)}</a>`
          ).join("") +
          `</td></tr>`;
      }

      const tasks: EmailTask[] = (uniqueRecipients as { email: string; full_name: string }[]).map((recipient) => {
        const safeName = escapeHtml(recipient.full_name || "there");

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#000;font-family:'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:16px;border:1px solid #1a1a1a;">
<tr><td style="background:linear-gradient(135deg,#E6A817,#FFD54F,#E6A817);padding:32px 40px;text-align:center;">
<h1 style="margin:0;font-size:24px;font-weight:800;color:#0a0a0a;">${safeSubject}</h1>
</td></tr>
<tr><td style="padding:32px 40px;">
<p style="margin:0 0 16px;font-size:16px;color:#fff;font-weight:600;">Hi ${safeName}!</p>
<p style="margin:0;font-size:14px;color:#a1a1aa;line-height:1.8;">${safeMsg}</p>
</td></tr>
${imagesHtml}
${buttonsHtml}
<tr><td style="padding:0 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#E6A817,transparent);"></div></td></tr>
<tr><td style="padding:24px 40px;text-align:center;">
<p style="margin:0;font-size:14px;font-weight:700;color:#E6A817;">${safeOrgName}</p>
<p style="margin:4px 0 0;font-size:11px;color:#52525b;">Powered by VERS</p>
</td></tr>
</table></td></tr></table></body></html>`;

        return {
          email: recipient.email,
          payload: {
            from: "VERS <vers@vionevents.com>",
            ...(replyTo ? { reply_to: replyTo } : {}),
            to: [recipient.email],
            subject,
            html,
          },
        };
      });

      const { sent, failed, results, failureReason } = await processEmailTasks(tasks, RESEND_API_KEY);
      const skipped = recipientsInput.length - uniqueRecipients.length;

      return new Response(JSON.stringify({
        success: true,
        sent,
        failed,
        total: tasks.length,
        requested: recipientsInput.length,
        skipped,
        failure_reason: failureReason,
        results,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ticket email branch (imports / generated tickets)
    const registrationsInput = Array.isArray(body.registrations) ? body.registrations : [];
    const title = normalizeString(body.eventTitle, "Your Event");

    if (registrationsInput.length === 0) throw new Error("No registrations provided");
    if (registrationsInput.length > 1000) throw new Error("Maximum 1000 recipients per request");

    // Fetch event details (date, time, location) from the first registration's event
    let eventDate = "TBA";
    let eventTime = "TBA";
    let eventLocation = "TBA";
    let eventDuration = "";

    // Try to look up event details from the first valid registration
    const firstReg = registrationsInput.find((r: any) => r?.registrationId);
    if (firstReg?.registrationId) {
      const { data: regData } = await supabaseAdmin
        .from("registrations")
        .select("event_id")
        .eq("id", firstReg.registrationId)
        .single();
      if (regData?.event_id) {
        const { data: eventData } = await supabaseAdmin
          .from("events")
          .select("date, time, location, duration")
          .eq("id", regData.event_id)
          .single();
        if (eventData) {
          eventDate = eventData.date || "TBA";
          eventTime = eventData.time || "TBA";
          eventLocation = eventData.location || "TBA";
          eventDuration = eventData.duration || "";
        }
      }
    }

    const safeEventDate = escapeHtml(eventDate);
    const safeEventTime = escapeHtml(eventTime);
    const safeEventLocation = escapeHtml(eventLocation);
    const safeEventDuration = escapeHtml(eventDuration);

    const seenEmails = new Set<string>();
    const tasks: EmailTask[] = [];

    for (const reg of registrationsInput) {
      const email = normalizeString(reg?.email).toLowerCase();
      const fullName = normalizeString(reg?.fullName);
      const ticketId = normalizeString(reg?.ticketId);
      const registrationId = typeof reg?.registrationId === "string" ? reg.registrationId : undefined;
      const regAttendeeType = normalizeString(reg?.attendeeType, "participant");
      const regTierName = normalizeString(reg?.tierName) || null;

      if (!email || !fullName || !ticketId) continue;
      if (!isValidEmail(email) || email.endsWith("@self.local")) continue;
      if (seenEmails.has(email)) continue;

      seenEmails.add(email);

      const safeName = escapeHtml(fullName);
      const safeTitle = escapeHtml(title);
      const safeTicketId = escapeHtml(ticketId);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticketId)}&bgcolor=FFFFFF&color=000000&margin=4&format=png&ecc=H`;

      const confirmAttendanceUrl = buildConfirmAttendanceUrl(ticketId);
      const telegramConnectUrl = buildTelegramConnectUrl({ email, fullName });

      const tc = getTypeContent(regAttendeeType, regTierName);

      const html = `
<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #fafafa; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #E6A817, #FFD54F); padding: 32px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px; color: #0a0a0a;">${escapeHtml(tc.approvalSubjectPrefix)} 🎟️</h1>
  </div>
  <div style="padding: 32px;">
    <div style="text-align:center;margin-bottom:20px;">
      <span style="display:inline-block;background:${tc.badgeColor};color:${tc.badgeTextColor};padding:6px 20px;border-radius:99px;font-size:12px;font-weight:700;letter-spacing:1px;">${escapeHtml(tc.badge)}</span>
    </div>
    <p style="color: #fafafa; font-size: 16px;">Hi ${safeName},</p>
    <p style="color: #a3a3a3; font-size: 14px; line-height: 1.6;">
      ${tc.approvalGreeting}
    </p>
    <div style="background: #171717; border: 1px solid #262626; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <h3 style="margin: 0 0 12px; color: #fafafa; font-size: 16px;">Your Ticket</h3>
      <p style="margin: 4px 0; color: #a3a3a3; font-size: 14px;"><strong style="color: #fafafa;">Name:</strong> ${safeName}</p>
      <p style="margin: 4px 0; color: #a3a3a3; font-size: 14px;"><strong style="color: #fafafa;">Event:</strong> ${safeTitle}</p>
      <p style="margin: 4px 0; color: #a3a3a3; font-size: 14px;"><strong style="color: #fafafa;">Ticket ID:</strong> <span style="color: #FFD54F; font-family: monospace; font-size: 18px;">${safeTicketId}</span></p>
      <p style="margin: 4px 0; color: #a3a3a3; font-size: 14px;"><strong style="color: #fafafa;">Access:</strong> <span style="display:inline-block;background:${tc.badgeColor};color:${tc.badgeTextColor};padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;">${escapeHtml(tc.badge)}</span></p>
      <p style="margin: 4px 0; color: #a3a3a3; font-size: 14px;"><strong style="color: #fafafa;">Status:</strong> <span style="color: #22c55e;">✓ Confirmed</span></p>
    </div>
    <div style="background: #171717; border: 1px solid #262626; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <h3 style="margin: 0 0 12px; color: #E6A817; font-size: 14px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">Event Details</h3>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #71717a; width: 90px;">📅 Date</td>
          <td style="padding: 6px 0; font-size: 13px; color: #fafafa;">${safeEventDate}</td>
        </tr>
        <tr><td colspan="2" style="border-bottom: 1px solid #262626;"></td></tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #71717a;">🕐 Time</td>
          <td style="padding: 6px 0; font-size: 13px; color: #fafafa;">${safeEventTime}</td>
        </tr>
        <tr><td colspan="2" style="border-bottom: 1px solid #262626;"></td></tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #71717a;">📍 Location</td>
          <td style="padding: 6px 0; font-size: 13px; color: #fafafa;">${safeEventLocation}</td>
        </tr>
        ${safeEventDuration ? `<tr><td colspan="2" style="border-bottom: 1px solid #262626;"></td></tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #71717a;">⏱ Duration</td>
          <td style="padding: 6px 0; font-size: 13px; color: #fafafa;">${safeEventDuration}</td>
        </tr>` : ""}
      </table>
    </div>
    <div style="text-align: center; margin: 24px 0;">
      <p style="color: #a3a3a3; font-size: 12px; margin-bottom: 12px;">Your QR Code for Check-in:</p>
      <img src="${qrUrl}" alt="QR Code" style="width: 200px; height: 200px; border-radius: 8px; border: 2px solid #FFD54F;" />
    </div>
    <p style="color: #a3a3a3; font-size: 14px; line-height: 1.6;">
      ${tc.closingLine}
    </p>
    <div style="background: #0d2137; border: 1px solid rgba(34,197,94,0.2); border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 8px; color: #fafafa; font-size: 14px; font-weight: 600;">📋 Will you be attending?</p>
      <p style="margin: 0 0 16px; color: #a3a3a3; font-size: 12px; line-height: 1.5;">Let the organizer know if you'll make it — it helps them plan better.</p>
      <a href="${confirmAttendanceUrl}" style="display: inline-block; background: linear-gradient(135deg, #22c55e, #16a34a); color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 32px; border-radius: 8px;">✓ Confirm Attendance</a>
    </div>
    <div style="background: #0d2137; border: 1px solid #0088cc33; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 8px; color: #fafafa; font-size: 14px; font-weight: 600;">📲 Get Reminders &amp; Updates on Telegram</p>
      <p style="margin: 0 0 16px; color: #a3a3a3; font-size: 12px; line-height: 1.5;">Never miss event updates — connect to our Telegram bot for reminders, announcements, and more.</p>
      <a href="${telegramConnectUrl}" style="display: inline-block; background: #0088cc; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 10px 24px; border-radius: 6px;">Connect Telegram</a>
    </div>
  </div>
  <div style="border-top: 1px solid #262626; padding: 24px; text-align: center;">
    <p style="margin: 0; color: #737373; font-size: 12px;">Powered by VERS</p>
  </div>
</div>`;

      tasks.push({
        email,
        registrationId,
        payload: {
          from: "VERS <vers@vionevents.com>",
          to: [email],
          subject: `${tc.approvalSubjectPrefix} — ${title}`,
          html,
        },
      });
    }

    if (tasks.length === 0) throw new Error("No valid registrations provided");

    const { sent, failed, results, failureReason } = await processEmailTasks(tasks, RESEND_API_KEY);

    const successIds = results
      .filter((row) => row.success && row.registrationId)
      .map((row) => row.registrationId as string);

    const failedIds = results
      .filter((row) => !row.success && row.registrationId)
      .map((row) => row.registrationId as string);

    if (successIds.length > 0) {
      await supabaseAdmin.from("registrations").update({ email_sent: true }).in("id", successIds);
    }

    if (failedIds.length > 0) {
      await supabaseAdmin.from("registrations").update({ email_sent: false }).in("id", failedIds);
    }

    return new Response(JSON.stringify({
      success: true,
      sent,
      failed,
      total: tasks.length,
      requested: registrationsInput.length,
      skipped: registrationsInput.length - tasks.length,
      failure_reason: failureReason,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Bulk email error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

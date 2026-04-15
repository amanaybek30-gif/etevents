import { supabase } from "@/integrations/supabase/client";

type CustomRecipient = {
  email: string;
  full_name?: string;
};

type TicketRecipient = {
  ticketId: string;
  fullName: string;
  email: string;
  registrationId?: string;
};

type CustomEmailPayload = {
  type: "custom_email";
  subject: string;
  message: string;
  recipients: CustomRecipient[];
  buttons?: Array<{ text: string; url: string }>;
  image_urls?: string[];
};

type TicketEmailPayload = {
  eventTitle: string;
  registrations: TicketRecipient[];
};

type SendBulkPayload = CustomEmailPayload | TicketEmailPayload;

type SendBulkResponse = {
  sent?: number;
  failed?: number;
  total?: number;
  requested?: number;
  skipped?: number;
  failure_reason?: string;
};

export type SendBulkAggregateResult = {
  sent: number;
  failed: number;
  total: number;
  requested: number;
  skipped: number;
  chunks: number;
  failureReason?: string;
};

const MAX_TOTAL_RECIPIENTS = 10000;
const CUSTOM_EMAIL_CHUNK_SIZE = 150;
const TICKET_EMAIL_CHUNK_SIZE = 150;
const CHUNK_RETRIES = 3;
const AUTH_REFRESH_WINDOW_MS = 90_000;
const AUTH_ERROR_REGEX = /unauthorized|invalid token|invalid jwt|jwt expired|missing authorization|insufficient permissions|forbidden|session expired|session is invalid|sign in again|\b401\b|\b403\b/i;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isCustomEmailPayload = (payload: SendBulkPayload): payload is CustomEmailPayload =>
  "type" in payload && payload.type === "custom_email";

const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const combineResponses = (a: SendBulkResponse, b: SendBulkResponse): SendBulkResponse => ({
  sent: toNumber(a.sent) + toNumber(b.sent),
  failed: toNumber(a.failed) + toNumber(b.failed),
  requested: toNumber(a.requested) + toNumber(b.requested),
  skipped: toNumber(a.skipped) + toNumber(b.skipped),
  total: toNumber(a.total) + toNumber(b.total),
  failure_reason: a.failure_reason || b.failure_reason,
});

const extractFunctionErrorMessage = async (error: unknown): Promise<string> => {
  const fallback = error instanceof Error ? error.message : "Bulk email request failed";
  const context = (error as { context?: Response })?.context;

  if (context && typeof context.clone === "function") {
    const status = typeof context.status === "number" ? context.status : null;

    try {
      const cloned = context.clone();
      const payload = await cloned.json().catch(async () => {
        const text = await cloned.text();
        return { error: text };
      });

      if (payload && typeof payload === "object") {
        const errorMessage =
          (payload as { error?: string }).error ??
          (payload as { message?: string }).message;

        if (typeof errorMessage === "string" && errorMessage.trim()) {
          return status ? `HTTP ${status}: ${errorMessage}` : errorMessage;
        }
      }
    } catch {
      // Ignore JSON parse issues and use fallback
    }

    if (status) {
      return `HTTP ${status}`;
    }
  }

  return fallback;
};

const getVerifiedAccessToken = async (): Promise<string> => {
  // Always force a fresh session refresh to avoid stale tokens
  const {
    data: { session: currentSession },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !currentSession?.access_token) {
    throw new Error("Your session expired. Please sign in again and retry.");
  }

  // Proactively refresh if within window or token looks stale
  const expiresAtMs = (currentSession.expires_at ?? 0) * 1000;
  const shouldRefresh =
    currentSession.refresh_token &&
    (expiresAtMs <= 0 || expiresAtMs - Date.now() < AUTH_REFRESH_WINDOW_MS);

  if (shouldRefresh) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session?.access_token) {
      return refreshed.session.access_token;
    }
  }

  return currentSession.access_token;
};

const invokeChunk = async (payload: SendBulkPayload): Promise<SendBulkResponse> => {
  const accessToken = await getVerifiedAccessToken();

  const { data, error } = await supabase.functions.invoke("send-bulk-tickets", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: payload,
  });

  if (error) {
    const message = await extractFunctionErrorMessage(error);
    throw new Error(message || "Bulk email request failed");
  }

  return (data ?? {}) as SendBulkResponse;
};

const invokeChunkWithRetry = async (payload: SendBulkPayload): Promise<SendBulkResponse> => {
  let lastError: Error | null = null;
  let forcedRefreshAttempted = false;

  for (let attempt = 0; attempt <= CHUNK_RETRIES; attempt += 1) {
    try {
      return await invokeChunk(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bulk email request failed";
      lastError = new Error(message);
      const lowerMessage = message.toLowerCase();
      const isAuthError = AUTH_ERROR_REGEX.test(lowerMessage);

      if (isAuthError && !forcedRefreshAttempted) {
        forcedRefreshAttempted = true;
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError) {
          continue;
        }
      }

      if (isAuthError || attempt === CHUNK_RETRIES) break;
      await sleep(700 * (attempt + 1));
    }
  }

  throw lastError ?? new Error("Bulk email request failed");
};

const sendCustomChunkWithFallback = async (
  subject: string,
  message: string,
  recipients: CustomRecipient[],
  buttons?: Array<{ text: string; url: string }>,
  image_urls?: string[],
): Promise<SendBulkResponse> => {
  const chunkPayload: CustomEmailPayload = {
    type: "custom_email",
    subject,
    message,
    recipients,
    ...(buttons && buttons.length > 0 ? { buttons } : {}),
    ...(image_urls && image_urls.length > 0 ? { image_urls } : {}),
  };

  try {
    return await invokeChunkWithRetry(chunkPayload);
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "Bulk email request failed";

    if (AUTH_ERROR_REGEX.test(errMessage.toLowerCase())) {
      throw error;
    }

    if (recipients.length <= 1) {
      return {
        sent: 0,
        failed: recipients.length,
        requested: recipients.length,
        skipped: 0,
        total: recipients.length,
        failure_reason: errMessage,
      };
    }

    const midpoint = Math.ceil(recipients.length / 2);
    const leftRecipients = recipients.slice(0, midpoint);
    const rightRecipients = recipients.slice(midpoint);

    const [left, right] = await Promise.all([
      sendCustomChunkWithFallback(subject, message, leftRecipients, buttons, image_urls),
      sendCustomChunkWithFallback(subject, message, rightRecipients, buttons, image_urls),
    ]);

    return combineResponses(left, right);
  }
};

const sendTicketChunkWithFallback = async (
  eventTitle: string,
  registrations: TicketRecipient[],
): Promise<SendBulkResponse> => {
  const chunkPayload: TicketEmailPayload = {
    eventTitle,
    registrations,
  };

  try {
    return await invokeChunkWithRetry(chunkPayload);
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "Bulk email request failed";

    if (AUTH_ERROR_REGEX.test(errMessage.toLowerCase())) {
      throw error;
    }

    if (registrations.length <= 1) {
      return {
        sent: 0,
        failed: registrations.length,
        requested: registrations.length,
        skipped: 0,
        total: registrations.length,
        failure_reason: errMessage,
      };
    }

    const midpoint = Math.ceil(registrations.length / 2);
    const leftRegs = registrations.slice(0, midpoint);
    const rightRegs = registrations.slice(midpoint);

    const [left, right] = await Promise.all([
      sendTicketChunkWithFallback(eventTitle, leftRegs),
      sendTicketChunkWithFallback(eventTitle, rightRegs),
    ]);

    return combineResponses(left, right);
  }
};

export const sendBulkTicketsChunked = async (payload: SendBulkPayload): Promise<SendBulkAggregateResult> => {
  const isCustom = isCustomEmailPayload(payload);

  let sent = 0;
  let failed = 0;
  let requested = 0;
  let skipped = 0;
  let chunks = 0;
  let failureReason: string | undefined;

  if (isCustom) {
    const recipients = payload.recipients;

    if (!recipients.length) {
      throw new Error("No recipients provided");
    }

    if (recipients.length > MAX_TOTAL_RECIPIENTS) {
      throw new Error(`Maximum ${MAX_TOTAL_RECIPIENTS} recipients per send. Please split your audience.`);
    }

    const recipientChunks = chunkArray<CustomRecipient>(recipients, CUSTOM_EMAIL_CHUNK_SIZE);
    chunks = recipientChunks.length;

    for (const recipientChunk of recipientChunks) {
      const response = await sendCustomChunkWithFallback(payload.subject, payload.message, recipientChunk, payload.buttons, payload.image_urls);

      sent += toNumber(response.sent);
      failed += toNumber(response.failed);
      requested += toNumber(response.requested, recipientChunk.length);
      skipped += toNumber(response.skipped);

      if (!failureReason && response.failure_reason) {
        failureReason = response.failure_reason;
      }
    }
  } else {
    const registrations = payload.registrations;

    if (!registrations.length) {
      throw new Error("No recipients provided");
    }

    if (registrations.length > MAX_TOTAL_RECIPIENTS) {
      throw new Error(`Maximum ${MAX_TOTAL_RECIPIENTS} recipients per send. Please split your audience.`);
    }

    const registrationChunks = chunkArray<TicketRecipient>(registrations, TICKET_EMAIL_CHUNK_SIZE);
    chunks = registrationChunks.length;

    for (const registrationChunk of registrationChunks) {
      const response = await sendTicketChunkWithFallback(payload.eventTitle, registrationChunk);

      sent += toNumber(response.sent);
      failed += toNumber(response.failed);
      requested += toNumber(response.requested, registrationChunk.length);
      skipped += toNumber(response.skipped);

      if (!failureReason && response.failure_reason) {
        failureReason = response.failure_reason;
      }
    }
  }

  if (sent === 0 && failed > 0 && failureReason) {
    throw new Error(failureReason);
  }

  return {
    sent,
    failed,
    total: sent + failed,
    requested,
    skipped,
    chunks,
    failureReason,
  };
};

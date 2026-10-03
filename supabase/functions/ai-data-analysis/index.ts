import { createClient } from "npm:@supabase/supabase-js@2";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText, type ModelMessage } from "npm:ai";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  LOVABLE_AIG_RUN_ID_HEADER,
} from "../_shared/run-id.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-lovable-aig-run-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": LOVABLE_AIG_RUN_ID_HEADER,
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });

const SCOPE_LABEL: Record<string, string> = {
  organizer: "an event organizer's event analytics (registrations, attendance, revenue, traffic)",
  crm: "an event organizer's attendee CRM (unique attendees, engagement, segments, retention)",
  admin: "the whole event platform (all organizers, events, registrations, subscriptions)",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Please sign in." }, 401);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Please sign in." }, 401);

    const { scope, data, messages } = await req.json();
    if (!SCOPE_LABEL[scope]) return json({ error: "Invalid analysis scope." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = !!roles?.some((r: { role: string }) => r.role === "admin");

    if (scope === "admin") {
      if (!isAdmin) return json({ error: "Admins only." }, 403);
    } else if (!isAdmin) {
      const { data: prof } = await admin
        .from("organizer_profiles")
        .select("subscription_plan, subscription_paid, subscription_expires_at")
        .eq("user_id", user.id)
        .maybeSingle();
      const active = prof?.subscription_paid && prof?.subscription_expires_at &&
        new Date(prof.subscription_expires_at) > new Date();
      if (!prof || !["pro", "corporate"].includes(prof.subscription_plan) || !active) {
        return json({ error: "AI data analysis is available on active Pro and Corporate plans." }, 403);
      }
    }

    const dataStr = JSON.stringify(data ?? {}).slice(0, 60000);
    const history: { role: "user" | "assistant"; content: string }[] = Array.isArray(messages)
      ? messages
          .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
          .slice(-12)
          .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
      : [];

    const system = `You are VERS Insights, an expert data analyst for ${SCOPE_LABEL[scope]}.
Use ONLY the JSON data provided below. Never invent numbers. If the data cannot answer a question, say so.
All percentages, rates, averages and scores must have exactly ONE decimal place (e.g. 47.4%). Counts stay whole numbers. Currency is ETB.
Write in clear, plain language for a non-technical event organizer. Use short markdown sections and bullet points. Keep answers under 350 words.

DATA:
${dataStr}`;

    const conversation: ModelMessage[] = history.length
      ? history
      : [{
          role: "user",
          content:
            "Give me an insights report with: 1) Key highlights, 2) What's working, 3) Concerns or risks, 4) 3-5 specific recommendations.",
        }];

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI service is not configured." }, 500);

    const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(req));
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    let upstreamError: any = null;
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      system,
      messages: conversation,
      abortSignal: req.signal,
      onError: ({ error }) => { upstreamError = error; },
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    let text = "";
    for await (const part of result.textStream) text += part;

    const runHeaders: Record<string, string> = {};
    const runId = runIdFetch.getRunId();
    if (runId) runHeaders[LOVABLE_AIG_RUN_ID_HEADER] = runId;

    if (!text.trim()) {
      const status = upstreamError?.statusCode ?? upstreamError?.lastError?.statusCode;
      if (status === 429) return json({ error: "Too many requests right now. Please try again in a minute." }, 429, runHeaders);
      if (status === 402) return json({ error: "AI credits have run out. Please contact the platform admin." }, 402, runHeaders);
      if (status === 403) return json({ error: "AI analysis is currently unavailable for this workspace." }, 403, runHeaders);
      console.error("ai-data-analysis empty result", upstreamError);
      return json({ error: "The AI could not produce an analysis. Please try again later." }, 502, runHeaders);
    }

    return json({ answer: text }, 200, runHeaders);
  } catch (error) {
    if (req.signal.aborted) return json({ error: "Cancelled" }, 499);
    console.error("ai-data-analysis error:", error);
    return json({ error: "Something went wrong while analyzing your data." }, 500);
  }
});

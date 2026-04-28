import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { surveyId } = await req.json();
    if (!surveyId) throw new Error("surveyId is required");

    // Verify organizer owns this survey and is corporate
    const { data: profile } = await supabase
      .from("organizer_profiles")
      .select("subscription_plan")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.subscription_plan !== "corporate") {
      return new Response(JSON.stringify({ error: "Survey analysis is only available on the Corporate plan." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch survey + responses
    const { data: survey } = await supabase.from("surveys").select("*").eq("id", surveyId).single();
    if (!survey) throw new Error("Survey not found");

    const { data: responses } = await supabase
      .from("survey_responses")
      .select("*")
      .eq("survey_id", surveyId)
      .order("created_at", { ascending: true });

    if (!responses || responses.length === 0) {
      return new Response(JSON.stringify({ error: "No responses to analyze." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get event info if linked
    let eventTitle = "Unknown Event";
    if (survey.event_id) {
      const { data: event } = await supabase.from("events").select("title").eq("id", survey.event_id).single();
      if (event) eventTitle = event.title;
    }

    // Build analysis prompt
    const questions = (survey.questions as any[]) || [];
    const questionTexts = questions.map((q: any) => q.text);

    const responseSummary = responses.map((r: any, i: number) => {
      const answers = r.answers || {};
      return `Response ${i + 1} (${new Date(r.created_at).toLocaleDateString()}):\n${Object.entries(answers).map(([q, a]) => `  ${q}: ${Array.isArray(a) ? a.join(", ") : String(a)}`).join("\n")}`;
    }).join("\n\n");

    const prompt = `You are an expert event survey analyst. Analyze the following survey data and produce a comprehensive, detailed report.

Survey Title: ${survey.title}
Event: ${eventTitle}
Total Responses: ${responses.length}
Questions: ${questionTexts.join(", ")}

--- RESPONSES ---
${responseSummary}
--- END RESPONSES ---

Produce a detailed report with these sections:
1. EXECUTIVE SUMMARY - Brief overview of key findings (2-3 sentences)
2. RESPONSE OVERVIEW - Total responses, response timeline, completion rate
3. QUESTION-BY-QUESTION ANALYSIS - For each question: summary of answers, percentages for choice questions, common themes for text questions, notable quotes
4. KEY INSIGHTS - Top 5 actionable insights from the data
5. SENTIMENT ANALYSIS - Overall sentiment (positive/neutral/negative) with reasoning
6. RECOMMENDATIONS - 3-5 specific, actionable recommendations for future events
7. AREAS OF IMPROVEMENT - What attendees want improved
8. STRENGTHS - What attendees appreciated most

Format the output as clean text with clear section headers. Use bullet points and percentages where applicable. IMPORTANT: All numbers, percentages, rates, and scores must be rounded to exactly ONE decimal place (e.g., 47.4%, not 47% and not 47.3826%).`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a professional survey data analyst. Provide thorough, data-driven analysis." },
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    const analysisText = aiData.choices?.[0]?.message?.content || "Analysis could not be generated.";

    return new Response(JSON.stringify({
      analysis: analysisText,
      surveyTitle: survey.title,
      eventTitle,
      totalResponses: responses.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-survey error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

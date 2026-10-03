import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Send, Lock } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  scope: "organizer" | "crm" | "admin";
  getData: () => unknown;
  locked?: boolean;
  lockedMessage?: string;
}

/** Render light markdown (headings, bullets, bold) safely as React nodes. */
const renderMd = (text: string) =>
  text.split("\n").map((line, i) => {
    const bold = (s: string) =>
      s.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
        p.startsWith("**") && p.endsWith("**") ? <strong key={j} className="text-foreground">{p.slice(2, -2)}</strong> : p,
      );
    const h = line.match(/^#{1,4}\s+(.*)/);
    if (h) return <p key={i} className="mt-3 font-display font-semibold text-primary">{bold(h[1])}</p>;
    const b = line.match(/^\s*[-*•]\s+(.*)/);
    if (b) return <p key={i} className="pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-primary">{bold(b[1])}</p>;
    if (!line.trim()) return <div key={i} className="h-2" />;
    return <p key={i}>{bold(line)}</p>;
  });

const AIInsightsPanel = ({ scope, getData, locked, lockedMessage }: Props) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (history: Msg[]) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-data-analysis", {
        body: { scope, data: getData(), messages: history },
      });
      let msg = data?.error as string | undefined;
      if (fnError) {
        try { msg = (await (fnError as any).context?.json())?.error; } catch { /* ignore */ }
        msg = msg || "Could not reach the AI service.";
      }
      if (msg) { setError(msg); return; }
      setMessages([...history, { role: "assistant", content: data.answer }]);
    } finally {
      setLoading(false);
    }
  };

  const generate = () => { setMessages([]); ask([]); };
  const send = () => {
    const q = input.trim();
    if (!q || loading) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    ask(next);
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="font-display font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> AI Insights
        </h4>
        {!locked && (
          <Button size="sm" onClick={generate} disabled={loading}>
            {loading && messages.length === 0 ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            {messages.length ? "Regenerate report" : "Generate insights"}
          </Button>
        )}
      </div>

      {locked ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Lock className="h-4 w-4" /> {lockedMessage || "AI Insights are available on Pro and Corporate plans."}
        </p>
      ) : (
        <>
          {messages.length === 0 && !loading && !error && (
            <p className="text-sm text-muted-foreground">Get an AI-powered summary of this data, or ask a question below.</p>
          )}
          <div className="space-y-3 max-h-[480px] overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-lg bg-primary/15 px-3 py-2 text-sm text-foreground" : "text-sm text-muted-foreground leading-relaxed"}>
                {m.role === "user" ? m.content : renderMd(m.content)}
              </div>
            ))}
            {loading && (
              <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Analyzing your data…</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about your data, e.g. Which event had the best attendance?"
              className="min-h-[44px] text-sm"
              rows={1}
            />
            <Button size="icon" onClick={send} disabled={loading || !input.trim()} aria-label="Ask AI">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default AIInsightsPanel;

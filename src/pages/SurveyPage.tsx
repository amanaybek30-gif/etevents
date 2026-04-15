import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle, ClipboardList } from "lucide-react";
import SEO from "@/components/SEO";

const SurveyPage = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: survey, isLoading } = useQuery({
    queryKey: ["survey", surveyId],
    queryFn: async () => {
      const { data } = await supabase.from("surveys").select("*").eq("id", surveyId!).eq("is_active", true).single();
      return data;
    },
    enabled: !!surveyId,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey) return;

    setSubmitting(true);
    const { error } = await supabase.from("survey_responses").insert({
      survey_id: survey.id,
      answers,
    } as any);

    if (error) { toast.error("Failed to submit"); setSubmitting(false); return; }
    setSubmitted(true);
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!survey) return <div className="flex min-h-screen items-center justify-center bg-background p-4"><div className="text-center"><h1 className="font-display text-2xl font-bold text-foreground">Survey Not Found</h1></div></div>;

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center space-y-4">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
          <h2 className="font-display text-xl font-bold text-foreground">Thank You!</h2>
          <p className="text-sm text-muted-foreground">Your response has been recorded.</p>
        </div>
      </div>
    );
  }

  const questions = (survey.questions as any[]) || [];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <SEO title={survey.title} description={`Survey: ${survey.title}`} path={`/survey/${surveyId}`} noindex />
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-primary mb-3" />
          <h1 className="font-display text-xl font-bold text-foreground">{survey.title}</h1>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 space-y-4">

          {questions.map((q: any, idx: number) => (
            <div key={q.id || idx} className="space-y-2">
              <Label>{q.text} {q.required && <span className="text-destructive">*</span>}</Label>
              {q.type === "short_answer" && (
                <Input value={answers[q.text] || ""} onChange={e => setAnswers(prev => ({ ...prev, [q.text]: e.target.value }))} className="border-border bg-secondary" />
              )}
              {q.type === "long_answer" && (
                <Textarea value={answers[q.text] || ""} onChange={e => setAnswers(prev => ({ ...prev, [q.text]: e.target.value }))} className="border-border bg-secondary min-h-[80px]" />
              )}
              {q.type === "multiple_choice" && (q.options || []).map((opt: string, oIdx: number) => (
                <label key={oIdx} className="flex items-center gap-2 text-sm text-foreground">
                  <input type="radio" name={q.id} value={opt} checked={answers[q.text] === opt}
                    onChange={() => setAnswers(prev => ({ ...prev, [q.text]: opt }))} className="accent-primary" />
                  {opt}
                </label>
              ))}
              {q.type === "checkbox" && (q.options || []).map((opt: string, oIdx: number) => (
                <label key={oIdx} className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox checked={(answers[q.text] || []).includes(opt)}
                    onCheckedChange={checked => {
                      const prev = answers[q.text] || [];
                      setAnswers(p => ({ ...p, [q.text]: checked ? [...prev, opt] : prev.filter((v: string) => v !== opt) }));
                    }} />
                  {opt}
                </label>
              ))}
              {q.type === "dropdown" && (
                <Select value={answers[q.text] || ""} onValueChange={v => setAnswers(prev => ({ ...prev, [q.text]: v }))}>
                  <SelectTrigger className="border-border bg-secondary"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {(q.options || []).map((opt: string, oIdx: number) => <SelectItem key={oIdx} value={opt}>{opt}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}

          <Button type="submit" disabled={submitting} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90 py-5">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
            Submit Response
          </Button>
        </form>
      </div>
    </div>
  );
};

export default SurveyPage;

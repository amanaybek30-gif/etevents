import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Plus, Trash2, Send, QrCode, ClipboardList, Eye, Loader2, X, Download, Lock, FileDown, BarChart3 } from "lucide-react";
import jsPDF from "jspdf";
import { sendBulkTicketsChunked } from "@/lib/sendBulkTickets";

interface Props {
  userId: string;
  userPlan?: string;
  subscriptionEnabled?: boolean;
  isPaid?: boolean;
  onRequirePlan?: () => void;
}

interface SurveyQuestion {
  id: string; text: string;
  type: "short_answer" | "long_answer" | "multiple_choice" | "checkbox" | "dropdown";
  options?: string[]; required: boolean;
}

interface Survey {
  id: string; title: string; event_id: string | null;
  questions: SurveyQuestion[]; is_active: boolean;
  created_at: string; responseCount?: number;
}

const OrganizerSurveys = ({ userId, userPlan = "free", subscriptionEnabled = false, isPaid = true, onRequirePlan }: Props) => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewSurveyId, setViewSurveyId] = useState<string | null>(null);
  const [viewResponses, setViewResponses] = useState<any[]>([]);
  const [qrSurveyId, setQrSurveyId] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState("");
  const [eventId, setEventId] = useState("");
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);

  // Plan checks
  const canEmailSurvey = !subscriptionEnabled || userPlan === "corporate";
  const canQRSurvey = !subscriptionEnabled || userPlan === "pro" || userPlan === "corporate";
  const canExport = !subscriptionEnabled || userPlan === "pro" || userPlan === "corporate";
  const canAnalyze = !subscriptionEnabled || userPlan === "corporate";

  useEffect(() => { fetchData(); }, [userId]);

  // Realtime subscription for live survey response updates
  useEffect(() => {
    const channel = supabase
      .channel('survey-responses-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'survey_responses' }, () => {
        fetchData();
        // Also refresh the response view if open
        if (viewSurveyId) {
          viewSurveyResponses(viewSurveyId);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [viewSurveyId]);

  const fetchData = async () => {
    const [{ data: evs }, { data: surveyData }] = await Promise.all([
      supabase.from("events").select("id, title, slug").eq("organizer_id", userId).order("date", { ascending: false }),
      supabase.from("surveys").select("*").eq("organizer_id", userId).order("created_at", { ascending: false }),
    ]);
    if (evs) setEvents(evs);
    if (surveyData) {
      const surveyIds = surveyData.map((s: any) => s.id);
      let responseCounts: Record<string, number> = {};
      if (surveyIds.length > 0) {
        const { data: responses } = await supabase.from("survey_responses").select("survey_id").in("survey_id", surveyIds);
        if (responses) responses.forEach((r: any) => { responseCounts[r.survey_id] = (responseCounts[r.survey_id] || 0) + 1; });
      }
      setSurveys(surveyData.map((s: any) => ({ ...s, questions: s.questions || [], responseCount: responseCounts[s.id] || 0 })));
    }
    setLoading(false);
  };

  const addQuestion = () => setQuestions(prev => [...prev, { id: `q-${Date.now()}`, text: "", type: "short_answer", required: false, options: [] }]);
  const updateQuestion = (idx: number, updates: Partial<SurveyQuestion>) => setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...updates } : q));
  const removeQuestion = (idx: number) => setQuestions(prev => prev.filter((_, i) => i !== idx));
  const addOption = (qIdx: number) => setQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, options: [...(q.options || []), ""] } : q));
  const updateOption = (qIdx: number, oIdx: number, value: string) => setQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, options: q.options?.map((o, j) => j === oIdx ? value : o) } : q));
  const removeOption = (qIdx: number, oIdx: number) => setQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, options: q.options?.filter((_, j) => j !== oIdx) } : q));

  const handleCreate = async () => {
    if (!isPaid) { onRequirePlan?.(); return; }
    if (!title.trim()) { toast.error("Enter a survey title"); return; }
    if (questions.length === 0) { toast.error("Add at least one question"); return; }
    if (questions.some(q => !q.text.trim())) { toast.error("All questions must have text"); return; }
    setSaving(true);
    const { error } = await supabase.from("surveys").insert({ organizer_id: userId, event_id: eventId || null, title: title.trim(), questions } as any);
    if (error) { toast.error("Failed to create survey"); setSaving(false); return; }
    toast.success("Survey created!");
    setCreating(false); setTitle(""); setEventId(""); setQuestions([]); setSaving(false);
    fetchData();
  };

  const sendSurveyEmails = async (surveyId: string) => {
    if (!canEmailSurvey) {
      toast.error("Sending surveys via email is only available on the Corporate plan.");
      return;
    }
    const survey = surveys.find(s => s.id === surveyId);
    if (!survey || !survey.event_id) { toast.error("Survey must be linked to an event"); return; }
    const { data: regs } = await supabase.from("registrations").select("full_name, email").eq("event_id", survey.event_id).eq("checked_in", true).neq("email", "");
    if (!regs || regs.length === 0) { toast.error("No checked-in attendees with email found"); return; }

    // Filter out self-registration placeholder emails
    const validRegs = regs.filter(r => !r.email.endsWith("@self.local") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email));
    if (validRegs.length === 0) { toast.error("No valid email addresses found among checked-in attendees"); return; }

    const surveyLink = `${window.location.origin}/survey/${surveyId}`;
    const eventTitle = events.find(e => e.id === survey.event_id)?.title || "the event";

    toast.loading(`Sending survey to ${validRegs.length} checked-in attendees...`, { id: "survey-send" });

    try {
      const result = await sendBulkTicketsChunked({
        type: "custom_email",
        subject: `We'd love your feedback — ${survey.title}`,
        message: `Thank you for attending ${eventTitle}! We'd really appreciate your feedback.\n\nPlease take a moment to fill out our survey:\n\n${surveyLink}\n\nYour responses help us improve future events. Thank you!`,
        recipients: validRegs.map(r => ({ email: r.email, full_name: r.full_name })),
      });

      const sent = Number(result?.sent ?? 0);
      const failed = Number(result?.failed ?? 0);
      if (sent === 0) throw new Error("No survey emails were delivered. Please retry.");

      if (failed > 0) {
        toast.warning(`Survey sent to ${sent} attendees, ${failed} failed.`, { id: "survey-send" });
      } else {
        toast.success(`Survey sent to ${sent} checked-in attendees!`, { id: "survey-send" });
      }
    } catch (err: any) {
      toast.error("Failed to send survey emails: " + (err?.message || "Unknown error"), { id: "survey-send" });
    }
  };

  const viewSurveyResponses = async (surveyId: string) => {
    const { data } = await supabase.from("survey_responses").select("*").eq("survey_id", surveyId).order("created_at", { ascending: false });
    setViewResponses(data || []); setViewSurveyId(surveyId);
  };

  const deleteSurvey = async (id: string) => {
    const { error } = await supabase.from("surveys").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Survey deleted"); fetchData();
  };

  const exportSurveyCSV = async (surveyId: string) => {
    if (!canExport) { toast.error("Export is available on Pro and Corporate plans."); return; }
    const survey = surveys.find(s => s.id === surveyId);
    if (!survey) return;

    const { data: responses } = await supabase.from("survey_responses").select("*").eq("survey_id", surveyId).order("created_at", { ascending: true });
    if (!responses || responses.length === 0) { toast.error("No responses to export"); return; }

    // Build CSV with each response as a separate row
    const questionTexts = survey.questions.map(q => q.text);
    const headers = ["#", "Submitted At", ...questionTexts];
    const rows = responses.map((r: any, i: number) => {
      const answers = r.answers || {};
      return [
        i + 1,
        new Date(r.created_at).toLocaleString(),
        ...questionTexts.map(qt => {
          const val = answers[qt];
          if (Array.isArray(val)) return val.join("; ");
          return val != null ? String(val) : "";
        }),
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${survey.title.replace(/[^a-zA-Z0-9]/g, "_")}_responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${responses.length} responses`);
  };

  const analyzeSurvey = async (surveyId: string) => {
    if (!canAnalyze) { toast.error("AI analysis is available on the Corporate plan only."); return; }
    setAnalyzingId(surveyId);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-survey", {
        body: { surveyId },
      });

      if (error) throw new Error(error.message || "Analysis failed");
      if (data?.error) throw new Error(data.error);

      const { analysis, surveyTitle, eventTitle, totalResponses } = data;

      // Generate PDF
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      let y = 20;

      const addText = (text: string, fontSize: number, isBold = false) => {
        pdf.setFontSize(fontSize);
        pdf.setFont("helvetica", isBold ? "bold" : "normal");
        const lines = pdf.splitTextToSize(text, maxWidth);
        for (const line of lines) {
          if (y > pdf.internal.pageSize.getHeight() - 20) {
            pdf.addPage();
            y = 20;
          }
          pdf.text(line, margin, y);
          y += fontSize * 0.5;
        }
        y += 4;
      };

      // Header
      addText("SURVEY ANALYSIS REPORT", 18, true);
      addText(`Survey: ${surveyTitle}`, 12, false);
      addText(`Event: ${eventTitle}`, 12, false);
      addText(`Total Responses: ${totalResponses}`, 12, false);
      addText(`Generated: ${new Date().toLocaleDateString()}`, 10, false);
      y += 6;

      // Divider
      pdf.setDrawColor(200);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Analysis content
      const sections = analysis.split("\n");
      for (const line of sections) {
        const trimmed = line.trim();
        if (!trimmed) { y += 3; continue; }

        // Detect headers (lines with ## or ALL CAPS or numbered sections)
        if (trimmed.match(/^#{1,3}\s/) || trimmed.match(/^\d+\.\s+[A-Z]/) || trimmed === trimmed.toUpperCase() && trimmed.length > 3) {
          y += 4;
          addText(trimmed.replace(/^#+\s*/, ""), 13, true);
        } else if (trimmed.startsWith("- ") || trimmed.startsWith("• ") || trimmed.startsWith("* ")) {
          addText(`  ${trimmed}`, 10, false);
        } else {
          addText(trimmed, 10, false);
        }
      }

      pdf.save(`${surveyTitle.replace(/[^a-zA-Z0-9]/g, "_")}_Analysis_Report.pdf`);
      toast.success("Analysis report downloaded as PDF!");
    } catch (err: any) {
      console.error("Survey analysis error:", err);
      toast.error(err.message || "Failed to analyze survey");
    } finally {
      setAnalyzingId(null);
    }
  };

  const downloadQR = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * 2; canvas.height = img.height * 2;
      ctx!.fillStyle = "#ffffff"; ctx!.fillRect(0, 0, canvas.width, canvas.height);
      ctx!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement("a");
      a.download = "survey-qr.png"; a.href = canvas.toDataURL("image/png"); a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" /> Surveys & Feedback
        </h3>
        <Button onClick={() => setCreating(true)} className="bg-gradient-gold text-primary-foreground hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" /> Create Survey
        </Button>
      </div>

      {/* Plan info banner */}
      {subscriptionEnabled && userPlan === "pro" && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground flex items-center gap-2">
          <QrCode className="h-4 w-4 text-primary shrink-0" />
          Your Pro plan includes survey distribution via QR code and data export. Upgrade to Corporate for email distribution and AI analysis.
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setCreating(false)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-foreground">Create Survey</h3>
            <div className="space-y-2">
              <Label>Survey Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Post-event feedback" className="border-border bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label>Link to Event</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger className="border-border bg-secondary"><SelectValue placeholder="Select event (optional)" /></SelectTrigger>
                <SelectContent>{events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Questions</Label>
                <Button type="button" size="sm" variant="outline" onClick={addQuestion} className="border-border text-xs"><Plus className="h-3 w-3 mr-1" /> Add Question</Button>
              </div>
              {questions.map((q, idx) => (
                <div key={q.id} className="rounded-lg border border-border bg-secondary/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Q{idx + 1}</span>
                    <button onClick={() => removeQuestion(idx)} className="text-destructive"><X className="h-4 w-4" /></button>
                  </div>
                  <Input value={q.text} onChange={e => updateQuestion(idx, { text: e.target.value })} placeholder="Question text..." className="border-border bg-secondary" />
                  <Select value={q.type} onValueChange={v => updateQuestion(idx, { type: v as any })}>
                    <SelectTrigger className="border-border bg-secondary h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short_answer">Short Answer</SelectItem>
                      <SelectItem value="long_answer">Long Answer</SelectItem>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                      <SelectItem value="dropdown">Dropdown</SelectItem>
                    </SelectContent>
                  </Select>
                  {["multiple_choice", "checkbox", "dropdown"].includes(q.type) && (
                    <div className="space-y-1">
                      {(q.options || []).map((opt, oIdx) => (
                        <div key={oIdx} className="flex gap-1">
                          <Input value={opt} onChange={e => updateOption(idx, oIdx, e.target.value)} placeholder={`Option ${oIdx + 1}`} className="border-border bg-secondary h-7 text-xs" />
                          <button onClick={() => removeOption(idx, oIdx)} className="text-destructive shrink-0"><X className="h-3 w-3" /></button>
                        </div>
                      ))}
                      <Button type="button" size="sm" variant="ghost" onClick={() => addOption(idx)} className="text-xs text-primary h-6">+ Add Option</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCreating(false)} className="flex-1 border-border">Cancel</Button>
              <Button onClick={handleCreate} disabled={saving} className="flex-1 bg-gradient-gold text-primary-foreground">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Create Survey
              </Button>
            </div>
          </div>
        </div>
      )}

      {surveys.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No surveys yet. Create one to gather feedback from attendees.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {surveys.map(s => (
            <div key={s.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-foreground">{s.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {s.questions.length} questions · {s.responseCount || 0} responses
                    {s.event_id && ` · ${events.find(e => e.id === s.event_id)?.title || ""}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  <Button size="sm" variant="ghost" onClick={() => viewSurveyResponses(s.id)} className="h-8 px-2" title="View Responses"><Eye className="h-4 w-4" /></Button>

                  {/* Export Button (Pro + Corporate) */}
                  {canExport ? (
                    <Button size="sm" variant="ghost" onClick={() => exportSurveyCSV(s.id)} className="h-8 px-2 text-emerald-600" title="Export CSV">
                      <FileDown className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled className="h-8 px-2 opacity-40" title="Export requires Pro plan"><FileDown className="h-4 w-4" /></Button>
                  )}

                  {/* Analyze Button (Corporate only) */}
                  {canAnalyze ? (
                    <Button size="sm" variant="ghost" onClick={() => analyzeSurvey(s.id)} disabled={analyzingId === s.id} className="h-8 px-2 text-violet-600" title="AI Analysis (PDF)">
                      {analyzingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled className="h-8 px-2 opacity-40" title="AI Analysis requires Corporate plan"><BarChart3 className="h-4 w-4" /></Button>
                  )}

                  {canQRSurvey ? (
                    <Button size="sm" variant="ghost" onClick={() => setQrSurveyId(qrSurveyId === s.id ? null : s.id)} className="h-8 px-2"><QrCode className="h-4 w-4" /></Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled className="h-8 px-2 opacity-40"><QrCode className="h-4 w-4" /></Button>
                  )}
                  {canEmailSurvey ? (
                    <Button size="sm" variant="ghost" onClick={() => sendSurveyEmails(s.id)} className="h-8 px-2 text-primary"><Send className="h-4 w-4" /></Button>
                  ) : (
                    <Button size="sm" variant="ghost" disabled className="h-8 px-2 opacity-40" title="Email surveys require Corporate plan"><Lock className="h-4 w-4" /></Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => deleteSurvey(s.id)} className="h-8 px-2 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              {qrSurveyId === s.id && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center space-y-2">
                  <div ref={qrRef} className="inline-block rounded-lg bg-white p-3">
                    <QRCodeSVG value={`${window.location.origin}/survey/${s.id}`} size={160} bgColor="#ffffff" fgColor="#000000" level="H" includeMargin />
                  </div>
                  <p className="text-xs text-muted-foreground break-all">{`${window.location.origin}/survey/${s.id}`}</p>
                  <div className="flex gap-2 justify-center">
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/survey/${s.id}`); toast.success("Link copied!"); }} className="text-xs">Copy Link</Button>
                    <Button size="sm" variant="outline" onClick={downloadQR} className="text-xs"><Download className="h-3 w-3 mr-1" /> Download QR</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {viewSurveyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setViewSurveyId(null)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-foreground">Survey Responses ({viewResponses.length})</h3>
              <button onClick={() => setViewSurveyId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            {viewResponses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No responses yet.</p>
            ) : (
              <div className="space-y-3">
                {viewResponses.map((r: any, idx: number) => (
                  <div key={r.id} className="rounded-lg border border-border bg-secondary p-3 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Response #{viewResponses.length - idx}</span>
                      <span>{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                    {Object.entries(r.answers || {}).map(([q, a]) => (
                      <div key={q} className="text-xs">
                        <span className="text-muted-foreground">{q}: </span>
                        <span className="text-foreground">{Array.isArray(a) ? (a as string[]).join(", ") : String(a)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizerSurveys;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mail, Send, Loader2, Users } from "lucide-react";

const AdminMarketing = ({ adminId }: { adminId: string }) => {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [audienceType, setAudienceType] = useState<"all" | "organizers" | "attendees">("all");
  const [recipientCount, setRecipientCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      if (audienceType === "organizers") {
        const { count } = await supabase.from("organizer_profiles").select("id", { count: "exact", head: true });
        setRecipientCount(count ?? 0);
      } else if (audienceType === "attendees") {
        const { count } = await supabase.from("attendee_accounts").select("id", { count: "exact", head: true });
        setRecipientCount(count ?? 0);
      } else {
        const [{ count: o }, { count: a }] = await Promise.all([
          supabase.from("organizer_profiles").select("id", { count: "exact", head: true }),
          supabase.from("attendee_accounts").select("id", { count: "exact", head: true }),
        ]);
        setRecipientCount((o ?? 0) + (a ?? 0));
      }
    };
    fetchCount();
  }, [audienceType]);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) { toast.error("Subject and body are required"); return; }
    setSending(true);
    try {
      const { data: fn, error } = await supabase.functions.invoke("send-marketing-email", {
        body: { subject, body, audience: audienceType },
      });
      if (error) throw error;
      toast.success(`Marketing email queued for ${recipientCount} recipients!`);
      setSubject(""); setBody("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    }
    setSending(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" /> Email Marketing
      </h2>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div>
          <p className="text-sm font-semibold text-foreground mb-2">Audience</p>
          <div className="flex gap-2">
            {(["all", "organizers", "attendees"] as const).map(t => (
              <button key={t} onClick={() => setAudienceType(t)} className={`rounded-full border px-4 py-1.5 text-sm transition-all ${audienceType === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}>
                {t === "all" ? "All Users" : t === "organizers" ? "Organizers" : "Attendees"}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Users className="h-3 w-3" /> {recipientCount} recipients</p>
        </div>

        <Input placeholder="Email Subject *" value={subject} onChange={e => setSubject(e.target.value)} />
        <Textarea placeholder="Email body (supports basic HTML) *" value={body} onChange={e => setBody(e.target.value)} rows={8} />

        <Button onClick={handleSend} disabled={sending} className="bg-gradient-gold text-primary-foreground hover:opacity-90">
          {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Send to {recipientCount} {audienceType === "all" ? "users" : audienceType}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Marketing emails are sent via the platform's email service. Use this to promote upcoming events, share platform updates, or send seasonal promotions.
        </p>
      </div>
    </div>
  );
};

export default AdminMarketing;

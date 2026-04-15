import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Send, Loader2, Eye, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { sendBulkTicketsChunked } from "@/lib/sendBulkTickets";
import type { AttendeeProfile } from "./types";

interface Props {
  recipients: AttendeeProfile[];
  onClose: () => void;
}

const CRMEmailDialog = ({ recipients, onClose }: Props) => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const validRecipients = recipients.filter(r =>
    r.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email) && !r.email.endsWith("@self.local")
  );

  const escHtml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] || c));

  const generatePreviewHtml = () => {
    const safeSubject = escHtml(subject || "Your Subject Here");
    const safeName = escHtml(validRecipients[0]?.full_name || "Attendee Name");
    const safeMsg = escHtml(message || "Your message will appear here...").replace(/\n/g, "<br/>");

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
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
<tr><td style="padding:0 40px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#E6A817,transparent);"></div></td></tr>
<tr><td style="padding:24px 40px;text-align:center;">
<p style="margin:0;font-size:14px;font-weight:700;color:#E6A817;">Your Organization</p>
<p style="margin:4px 0 0;font-size:11px;color:#52525b;">Powered by VERS</p>
</td></tr>
</table></td></tr></table></body></html>`;
  };

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please enter both subject and message");
      return;
    }
    if (validRecipients.length === 0) {
      toast.error("No valid email recipients in this segment");
      return;
    }

    setSending(true);
    try {
      const result = await sendBulkTicketsChunked({
        type: "custom_email",
        subject: subject.trim(),
        message: message.trim(),
        recipients: validRecipients.map(r => ({ email: r.email, full_name: r.full_name })),
      });

      const sent = Number(result.sent ?? 0);
      const failed = Number(result.failed ?? 0);

      if (sent === 0) {
        throw new Error("No invitations were delivered. Please retry.");
      }

      if (failed > 0) {
        toast.warning(`Invitations sent to ${sent} attendees, ${failed} failed.`);
      } else {
        toast.success(`Invitations sent to ${sent} attendees!`);
      }
      onClose();
    } catch (err: any) {
      toast.error("Failed to send emails: " + (err?.message || "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] rounded-xl border border-border bg-card flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-3">
          <h3 className="font-display text-lg font-bold text-foreground">Send Email to Segment</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-6 pb-3">
          <p className="text-sm text-muted-foreground">
            Sending to <strong className="text-foreground">{validRecipients.length}</strong> attendee{validRecipients.length !== 1 ? "s" : ""} with valid emails
            {recipients.length !== validRecipients.length && (
              <span className="text-destructive"> ({recipients.length - validRecipients.length} skipped — no valid email)</span>
            )}
          </p>
        </div>

        {/* Toggle tabs */}
        <div className="px-6 pb-3 flex gap-2">
          <Button
            variant={!showPreview ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPreview(false)}
          >
            <Edit3 className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant={showPreview ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Preview
          </Button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {!showPreview ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Subject</label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="You're invited!" className="border-border bg-secondary" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Message</label>
                <Textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="We'd love to see you at our upcoming event..."
                  className="border-border bg-secondary min-h-[180px]"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Each recipient will be greeted by name automatically. Line breaks are preserved in the email.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Preview shows how the first recipient will see the email. Names are personalized per recipient.</p>
              <div className="rounded-lg border border-border overflow-hidden bg-black">
                <iframe
                  title="Email Preview"
                  srcDoc={generatePreviewHtml()}
                  className="w-full border-0"
                  style={{ height: "420px" }}
                  sandbox=""
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-6 pt-3 border-t border-border">
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button onClick={handleSend} disabled={sending || validRecipients.length === 0}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send Invitations
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CRMEmailDialog;

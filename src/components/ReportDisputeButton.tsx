import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Flag } from "lucide-react";

interface Props {
  eventId?: string;
  eventTitle?: string;
  className?: string;
}

const ReportDisputeButton = ({ eventId, eventTitle, className }: Props) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [issue, setIssue] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !issue.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("disputes").insert({
        user_name: name.trim(),
        user_email: email.trim(),
        event_title: eventTitle || "General",
        event_id: eventId || null,
        issue: issue.trim(),
        description: description.trim() || null,
      } as any);
      if (error) throw error;
      toast.success("Report submitted. Our team will review it shortly.");
      setOpen(false);
      setName(""); setEmail(""); setIssue(""); setDescription("");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors ${className || ""}`}
      >
        <Flag className="h-3 w-3" /> Report Issue
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Report an Issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {eventTitle && (
              <p className="text-xs text-muted-foreground">
                Regarding: <span className="font-medium text-foreground">{eventTitle}</span>
              </p>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Your Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="border-border bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Your Email *</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="border-border bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Issue *</Label>
              <Input value={issue} onChange={e => setIssue(e.target.value)} placeholder="Brief summary of the issue" className="border-border bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Details</Label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Provide more context..."
                rows={3}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button onClick={handleSubmit} disabled={submitting} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90">
              {submitting ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReportDisputeButton;

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Users, CheckCircle } from "lucide-react";

interface Props {
  eventId: string;
  eventTitle: string;
}

const WaitlistForm = ({ eventId, eventTitle }: Props) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setSubmitting(true);

    // Get current max position
    const { data: existing } = await supabase.from("event_waitlist")
      .select("position")
      .eq("event_id", eventId)
      .order("position", { ascending: false })
      .limit(1);

    const nextPosition = (existing && existing.length > 0) ? existing[0].position + 1 : 1;

    const { error } = await supabase.from("event_waitlist").insert({
      event_id: eventId,
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      position: nextPosition,
    });

    setSubmitting(false);
    if (error) {
      toast.error("Failed to join waitlist");
      return;
    }
    setSubmitted(true);
    toast.success("You've been added to the waitlist!");
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center space-y-3">
        <CheckCircle className="mx-auto h-10 w-10 text-primary" />
        <h3 className="font-display text-lg font-bold text-foreground">You're on the Waitlist!</h3>
        <p className="text-sm text-muted-foreground">
          We'll send you an email with a registration link if a spot opens up. The invite will be valid for 24 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-bold text-foreground">Join the Waitlist</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        This event is at full capacity. Join the waitlist and we'll notify you when a spot opens up.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="wl-name" className="text-sm text-foreground">Full Name</Label>
          <Input id="wl-name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" className="border-border bg-secondary mt-1" required />
        </div>
        <div>
          <Label htmlFor="wl-email" className="text-sm text-foreground">Email</Label>
          <Input id="wl-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="border-border bg-secondary mt-1" required />
        </div>
        <div>
          <Label htmlFor="wl-phone" className="text-sm text-foreground">Phone</Label>
          <Input id="wl-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+251..." className="border-border bg-secondary mt-1" required />
        </div>
        <Button type="submit" disabled={submitting} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90">
          {submitting ? "Joining..." : "Join Waitlist"}
        </Button>
      </form>
    </div>
  );
};

export default WaitlistForm;

import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle, Ticket } from "lucide-react";
import { z } from "zod";
import SEO from "@/components/SEO";

const quickRegisterSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
  phone: z
    .string()
    .trim()
    .transform((value) => {
      if (value.startsWith("+")) return `+${value.slice(1).replace(/\D/g, "")}`;
      return value.replace(/\D/g, "");
    })
    .refine((value) => value.length >= 7 && value.length <= 20, {
      message: "Phone number must be between 7 and 20 characters",
    }),
  email: z.union([
    z.literal(""),
    z.string().trim().email("Invalid email address").max(255, "Email is too long"),
  ]),
  organization: z.union([
    z.literal(""),
    z.string().trim().max(120, "Organization is too long"),
  ]),
});

const QuickRegister = () => {
  const { slug } = useParams<{ slug: string }>();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ticketId, setTicketId] = useState("");

  const { data: event, isLoading } = useQuery({
    queryKey: ["quick-register-event", slug],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_event_for_registration", { event_slug: slug! });
      if (!data || data.length === 0) return null;
      const row = data[0];
      return { id: row.event_id, title: row.event_title, slug: row.event_slug_out, date: row.event_date, time: row.event_time, location: row.event_location };
    },
    enabled: !!slug,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    const parsed = quickRegisterSchema.safeParse({
      fullName,
      phone,
      email,
      organization,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Please check your details and try again");
      return;
    }

    const cleanName = parsed.data.fullName;
    const cleanPhone = parsed.data.phone;
    const cleanEmail = parsed.data.email || null;
    const cleanOrganization = parsed.data.organization || null;

    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any).rpc("quick_register_self", {
        p_event_slug: event.slug,
        p_full_name: cleanName,
        p_phone: cleanPhone,
        p_email: cleanEmail,
        p_organization: cleanOrganization,
      });

      if (error) throw error;

      const generatedTicketId = Array.isArray(data) ? data[0]?.ticket_id : data?.ticket_id;
      if (!generatedTicketId) {
        throw new Error("Registration completed but no ticket ID was returned.");
      }

      setTicketId(generatedTicketId);
      setSuccess(true);
      toast.success("Registration successful!");

      // Send welcome registration email (fire and forget)
      if (cleanEmail) {
        supabase.functions.invoke("send-registration-email", {
          body: {
            eventTitle: event.title,
            fullName: cleanName,
            email: cleanEmail,
            eventSlug: event.slug,
            attendeeType: "participant",
            tierName: null,
          },
        }).catch(err => console.error("QR self-reg welcome email failed:", err));
      }
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-foreground">Event Not Found</h1>
          <Button asChild className="bg-gradient-gold text-primary-foreground"><Link to="/">Go Home</Link></Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center space-y-4">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
          <h2 className="font-display text-xl font-bold text-foreground">You're Registered!</h2>
          <p className="text-sm text-muted-foreground">
            Welcome to <span className="text-primary font-semibold">{event.title}</span>
          </p>
          <div className="rounded-lg border border-border bg-secondary p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Your Ticket ID</p>
            <p className="font-mono text-lg font-bold text-primary">{ticketId}</p>
          </div>
          <p className="text-xs text-muted-foreground">Status: <span className="text-green-500">Checked In ✓</span></p>
          <p className="text-xs text-muted-foreground">You're all set! Enjoy the event.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <SEO title={`Register – ${event.title}`} description={`Quick registration for ${event.title}`} path={`/event/${slug}/quick-register`} noindex />
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Ticket className="mx-auto h-10 w-10 text-primary mb-3" />
          <h1 className="font-display text-xl font-bold text-foreground">{event.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{event.date} · {event.location}</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-center">Quick Registration</h2>
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" className="border-border bg-secondary" required />
          </div>
          <div className="space-y-2">
            <Label>Phone Number *</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+251..." className="border-border bg-secondary" required />
          </div>
          <div className="space-y-2">
            <Label>Email (Optional)</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="border-border bg-secondary" />
          </div>
          <div className="space-y-2">
            <Label>Organization (Optional)</Label>
            <Input value={organization} onChange={e => setOrganization(e.target.value)} placeholder="Company or organization" className="border-border bg-secondary" />
          </div>
          <Button type="submit" disabled={submitting} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90 py-5">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
            Register Now
          </Button>
        </form>
      </div>
    </div>
  );
};

export default QuickRegister;

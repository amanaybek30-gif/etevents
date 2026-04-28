import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = email.trim().toLowerCase();
    if (!cleaned) {
      toast.error("Please enter your email");
      return;
    }
    if (!/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(cleaned)) {
      toast.error("Please enter a valid email");
      return;
    }

    setLoading(true);
    try {
      // Block suspended/banned emails
      const { data: banned } = await supabase
        .from("banned_emails" as any)
        .select("id")
        .eq("email", cleaned)
        .maybeSingle();
      if (banned) {
        toast.error("This account is suspended or removed. Please contact admin.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("send-password-reset-email", {
        body: {
          email: cleaned,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSent(true);
      toast.success("Reset link sent! Check your inbox.");
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Forgot Password"
        description="Reset your VERS account password securely."
        path="/forgot-password"
      />
      <Navbar />
      <div className="flex min-h-[80vh] items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/30">
              {sent ? (
                <CheckCircle2 className="h-6 w-6 text-primary" />
              ) : (
                <KeyRound className="h-6 w-6 text-primary" />
              )}
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {sent ? "Check Your Email" : "Forgot Password"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {sent
                ? "We've sent a secure password reset link to your email. The link is valid for 1 hour."
                : "Enter your email and we'll send you a secure link to reset your password."}
            </p>
          </div>

          {sent ? (
            <div className="space-y-4 rounded-xl border border-border bg-card p-6">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
                <p className="text-sm text-foreground font-medium break-all">{email}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Didn't receive it? Check your spam folder or try again in a minute.
                </p>
              </div>
              <Button
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                variant="outline"
                className="w-full"
              >
                Send to a different email
              </Button>
              <Button
                onClick={() => navigate("/auth")}
                className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
              >
                Back to Sign In
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 rounded-xl border border-border bg-card p-6"
            >
              <div className="space-y-2">
                <Label className="text-xs">Email Address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10 border-border bg-secondary"
                    required
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Enter the email associated with your VERS account.
                </p>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Verify Email & Send Reset Link
              </Button>
              <Link
                to="/auth"
                className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors pt-1"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to Sign In
              </Link>
            </form>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ForgotPassword;

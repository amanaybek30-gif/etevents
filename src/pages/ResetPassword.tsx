import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Supabase places recovery tokens in the URL hash on page load and
    // automatically converts them into a session via onAuthStateChange.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setValidSession(true);
        setChecking(false);
      }
    });

    // Fallback: if there's already a session (user clicked link, hash already processed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValidSession(true);
      setChecking(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      // Get current user's email so we can verify the new password is different
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Session expired. Request a new reset link.");

      // Verify new password is NOT the same as the current one
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (!signInError) {
        // signIn succeeded => password matches the current one
        toast.error("Your new password cannot be the same as your current password. Please choose a different one.");
        setLoading(false);
        return;
      }

      // Now update to the new password
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        // Supabase will also throw "New password should be different from the old password" if same as current
        if (error.message.toLowerCase().includes("different") || error.message.toLowerCase().includes("same")) {
          toast.error("Your new password cannot be the same as a recently used password.");
        } else {
          throw error;
        }
        setLoading(false);
        return;
      }

      toast.success("Password updated! Signing you in...");
      setTimeout(() => navigate("/auth"), 1200);
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Reset Password" description="Set a new password for your VERS account." path="/reset-password" />
      <Navbar />
      <div className="flex min-h-[80vh] items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/30">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">Reset Your Password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter a new password. It must be different from your current and previously used passwords.
            </p>
          </div>

          {checking ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying reset link...
            </div>
          ) : !validSession ? (
            <div className="rounded-xl border border-destructive/40 bg-card p-6 text-center space-y-3">
              <p className="text-sm text-foreground">This reset link is invalid or has expired.</p>
              <Button onClick={() => navigate("/auth")} variant="outline" className="w-full">
                Back to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6">
              <div className="space-y-2">
                <Label className="text-xs">New Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="pl-10 border-border bg-secondary"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Confirm New Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter new password"
                    className="pl-10 border-border bg-secondary"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Update Password
              </Button>
              <p className="text-[11px] text-center text-muted-foreground pt-1">
                For your security, your new password must be different from your current password.
              </p>
            </form>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ResetPassword;

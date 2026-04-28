import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lock, ShieldCheck, KeyRound } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Recovery tokens in the URL hash are auto-converted into a session
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setValidSession(true);
        if (session?.user.email) setUserEmail(session.user.email);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setValidSession(true);
        if (session.user.email) setUserEmail(session.user.email);
      }
      setChecking(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    if (password.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("New passwords don't match");
      return;
    }
    if (password === currentPassword) {
      toast.error("Your new password cannot be the same as your current password.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Session expired. Please request a new reset link.");

      // Step 1: Verify the current password by attempting sign-in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (verifyError) {
        toast.error("Current password is incorrect. Please try again.");
        setLoading(false);
        return;
      }

      // Step 2: Defensive — ensure new password is not the same as current.
      // (Already checked above, but double-check after verification)
      if (password === currentPassword) {
        toast.error("Your new password cannot be the same as your current password.");
        setLoading(false);
        return;
      }

      // Step 3: Update to the new password.
      // Supabase will also block reusing the same password as the current one.
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("different") || msg.includes("same") || msg.includes("new password")) {
          toast.error("Your new password cannot be the same as your current password.");
        } else {
          throw error;
        }
        setLoading(false);
        return;
      }

      toast.success("Password updated successfully! Please sign in with your new password.");
      // Sign out so they must log in fresh with new credentials
      await supabase.auth.signOut();
      setTimeout(() => navigate("/auth"), 1200);
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Reset Password"
        description="Set a new password for your VERS account."
        path="/reset-password"
      />
      <Navbar />
      <div className="flex min-h-[80vh] items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/30">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">Set New Password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Verify your current password, then choose a new one.
            </p>
            {userEmail && validSession && (
              <p className="mt-2 text-xs text-primary font-medium">{userEmail}</p>
            )}
          </div>

          {checking ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying reset link...
            </div>
          ) : !validSession ? (
            <div className="rounded-xl border border-destructive/40 bg-card p-6 text-center space-y-3">
              <p className="text-sm text-foreground">This reset link is invalid or has expired.</p>
              <Button
                onClick={() => navigate("/forgot-password")}
                className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
              >
                Request a new link
              </Button>
              <Button onClick={() => navigate("/auth")} variant="outline" className="w-full">
                Back to Sign In
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 rounded-xl border border-border bg-card p-6"
            >
              <div className="space-y-2">
                <Label className="text-xs">Current Password *</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="pl-10 border-border bg-secondary"
                    required
                  />
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-4">
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
                  <Label className="text-xs">Re-enter New Password *</Label>
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
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                Update Password
              </Button>
              <p className="text-[11px] text-center text-muted-foreground pt-1">
                Your new password must be different from your current password.
                Your old password will no longer work after this change.
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

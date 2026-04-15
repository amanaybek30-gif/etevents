import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, User, Mail, Lock, ArrowRight, MessageCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const TELEGRAM_BOT_USERNAME = "VERSAssistantbot";

const AttendeeAuth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const telegramIntent = searchParams.get("intent") === "telegram" || localStorage.getItem("telegram_connect_intent") === "true";

  const [mode, setMode] = useState<"login" | "signup">(telegramIntent ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const redirectToTelegram = (token: string) => {
    const telegramUrl = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(token)}`;
    const popup = window.open(telegramUrl, "_blank", "noopener,noreferrer");

    if (popup) return;

    if (window.top && window.top !== window) {
      window.top.location.href = telegramUrl;
      return;
    }

    window.location.assign(telegramUrl);
  };

  const autoConnectTelegram = async (uid: string, signupData?: { fullName?: string; email?: string; phone?: string }) => {
    const normalizedEmail = signupData?.email?.trim().toLowerCase() || email.trim().toLowerCase();
    const normalizedFullName = signupData?.fullName?.trim() || fullName.trim();
    const normalizedPhone = signupData?.phone?.trim() || phone.trim();

    try {
      const { data, error } = await supabase.functions.invoke("telegram-auto-connect", {
        body: {
          userId: uid,
          fullName: normalizedFullName,
          email: normalizedEmail,
          phone: normalizedPhone,
        },
      });

      if (error) throw error;

      if (data?.alreadyLinked) {
        toast.success("Telegram is already connected!");
        navigate("/my-account");
        return;
      }

      const token = data?.token;
      if (!token) throw new Error("No token returned");

      localStorage.removeItem("telegram_connect_intent");
      toast.success("Redirecting to Telegram — press Start to connect!");
      redirectToTelegram(token);
    } catch (err) {
      console.error("Auto-connect Telegram failed:", err);
      navigate("/my-account");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const { data: banned } = await supabase.from("banned_emails" as any).select("id, reason").eq("email", normalizedEmail).maybeSingle();
      if (banned) {
        const reason = (banned as any).reason || "";
        if (reason.includes("deactivated")) {
          toast.error("This account has been permanently deactivated. You cannot sign in.");
        } else {
          toast.error("This account has been suspended. Contact admin for help.");
        }
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) throw error;

      if (telegramIntent && data.user) {
        await autoConnectTelegram(data.user.id, {
          fullName: typeof data.user.user_metadata?.full_name === "string" ? data.user.user_metadata.full_name : "",
          email: data.user.email || normalizedEmail,
          phone: typeof data.user.user_metadata?.phone === "string" ? data.user.user_metadata.phone : "",
        });
        return;
      }

      toast.success("Welcome back!");
      navigate("/my-account");
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedFullName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    if (!normalizedFullName) {
      toast.error("Full name is required");
      return;
    }

    if (!agreed) {
      toast.error("Please agree to the terms to continue");
      return;
    }

    setLoading(true);

    try {
      const { data: banned } = await supabase.from("banned_emails" as any).select("id, reason").eq("email", normalizedEmail).maybeSingle();
      if (banned) {
        const reason = (banned as any).reason || "";
        if (reason.includes("deactivated")) {
          toast.error("This email has been permanently deactivated. You cannot sign up with this email.");
        } else {
          toast.error("This email has been banned from the platform.");
        }
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: normalizedFullName,
            phone: normalizedPhone || null,
          },
        },
      });
      if (error) throw error;

      if (data.user) {
        if (telegramIntent) {
          await autoConnectTelegram(data.user.id, {
            fullName: normalizedFullName,
            email: normalizedEmail,
            phone: normalizedPhone,
          });
          return;
        }

        try {
          await supabase.from("attendee_accounts").insert({
            user_id: data.user.id,
            full_name: normalizedFullName,
            email: normalizedEmail,
            phone: normalizedPhone || null,
          } as any);
        } catch {}

        try {
          await supabase.from("user_roles").insert({
            user_id: data.user.id,
            role: "attendee",
          } as any);
        } catch {}

        supabase.functions.invoke("send-attendee-welcome", {
          body: { fullName: normalizedFullName, email: normalizedEmail, phone: normalizedPhone || null },
        }).catch(() => {});
      }

      toast.success("Account created! Please check your email to verify your account.");
      setMode("login");
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const showTelegramSignupOnly = telegramIntent && mode === "signup";

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Attendee Sign In" description="Sign in or create an attendee account on VERS to register for events and manage your profile." path="/attendee-auth" />
      <Navbar />
      <div className="flex min-h-[80vh] items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/30">
              {telegramIntent ? <MessageCircle className="h-6 w-6 text-primary" /> : <User className="h-6 w-6 text-primary" />}
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {telegramIntent
                ? "Create Your VERS Account"
                : (mode === "login" ? "Welcome Back" : "Create Your Account")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {telegramIntent
                ? "Sign up to connect with our Telegram bot and get event updates"
                : (mode === "login" ? "Sign in to access your saved events" : "Join to save events, RSVP faster, and more")}
            </p>
          </div>

          {!showTelegramSignupOnly && (
            <div className="flex rounded-lg border border-border bg-secondary p-1">
              <button
                onClick={() => setMode("login")}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                Sign In
              </button>
              <button
                onClick={() => setMode("signup")}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                Sign Up
              </button>
            </div>
          )}

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4 rounded-xl border border-border bg-card p-6">
              <div className="space-y-2">
                <Label className="text-xs">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" className="pl-10 border-border bg-secondary" required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" className="pl-10 border-border bg-secondary" required
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                {telegramIntent ? "Sign In & Connect Telegram" : "Sign In"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4 rounded-xl border border-border bg-card p-6">
              <div className="space-y-2">
                <Label className="text-xs">Full Name *</Label>
                <Input
                  value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Your full name" className="border-border bg-secondary" required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" className="pl-10 border-border bg-secondary" required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Phone (optional)</Label>
                <Input
                  value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+251..." className="border-border bg-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min 6 characters" className="pl-10 border-border bg-secondary" required minLength={6}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-start gap-3 rounded-lg border border-border bg-secondary/50 p-3 cursor-pointer hover:border-primary/50 transition-colors">
                  <Checkbox
                    id="agree-terms"
                    checked={agreed}
                    onCheckedChange={(checked) => setAgreed(checked === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    I agree to the{" "}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80" onClick={e => e.stopPropagation()}>Terms of Service</a>{" "}
                    and{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80" onClick={e => e.stopPropagation()}>Privacy Policy</a>.
                    {telegramIntent && " By connecting Telegram, I consent to receive event reminders, updates, and announcements via the VERS Telegram bot."}
                  </span>
                </label>
                {telegramIntent && (
                  <div className="rounded-lg border border-border bg-secondary p-3 text-xs text-muted-foreground space-y-1.5 max-h-40 overflow-y-auto">
                    <p className="font-semibold text-foreground text-xs">Telegram Connection Terms</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Your Telegram account will be linked to your VERS profile for event notifications.</li>
                      <li>You may receive event reminders (24h, 6h, 1h before events), updates, and announcements from organizers.</li>
                      <li>You can disable notifications at any time from your account settings or by blocking the bot.</li>
                      <li>Your Telegram username and chat ID are stored securely and used only for delivering notifications.</li>
                      <li>Organizers may send promotional messages related to events you registered for.</li>
                      <li>VERS will never share your Telegram data with third parties.</li>
                      <li>You can disconnect Telegram from your profile at any time.</li>
                    </ul>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading || !agreed}
                className="w-full bg-gradient-gold hover:opacity-90 text-primary-foreground"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : telegramIntent ? (
                  <MessageCircle className="mr-2 h-4 w-4" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                {loading
                  ? "Creating account..."
                  : telegramIntent
                    ? "Create Account & Connect Telegram"
                    : "Create Account"}
              </Button>
            </form>
          )}

          {showTelegramSignupOnly && (
            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <button onClick={() => setMode("login")} className="text-primary hover:underline">
                Sign in instead
              </button>
            </p>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Are you an event organizer?{" "}
            <a href="/organizer-auth" className="text-primary hover:underline">Sign in here</a>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AttendeeAuth;

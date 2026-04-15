import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, LogIn, Mail, Lock, User, Phone, ArrowRight, Calendar, Search, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

type Step = "auth" | "choose-role";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const intent = searchParams.get("intent");

  const [step, setStep] = useState<Step>("auth");
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [showTos, setShowTos] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) redirectByRole(session.user.id);
    });
  }, []);

  const redirectByRole = async (uid: string) => {
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    if (roles?.some(r => r.role === "admin")) {
      navigate("/admin");
    } else if (roles?.some(r => r.role === "organizer")) {
      navigate("/organizer");
    } else if (roles?.some(r => r.role === "attendee")) {
      navigate("/my-account");
    } else {
      const { data: orgProfile } = await supabase.from("organizer_profiles").select("id").eq("user_id", uid).maybeSingle();
      if (orgProfile) {
        navigate("/organizer");
      } else {
        setUserId(uid);
        setStep("choose-role");
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: banned } = await supabase.from("banned_emails" as any).select("id, reason").eq("email", email).maybeSingle();
      if (banned) {
        const reason = (banned as any).reason || "";
        toast.error(reason.includes("suspended") ? "Your account has been suspended. Contact admin." : "This account has been permanently removed.");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: profile } = await supabase.from("organizer_profiles").select("is_suspended").eq("user_id", data.user.id).maybeSingle();
      if (profile?.is_suspended) {
        await supabase.auth.signOut();
        toast.error("Your account has been suspended. Contact admin.");
        setLoading(false);
        return;
      }
      toast.success("Welcome back!");
      await redirectByRole(data.user.id);
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { toast.error("Full name is required"); return; }
    if (!tosAccepted) { toast.error("Please accept the Terms of Service"); return; }
    setLoading(true);
    try {
      const { data: banned } = await supabase.from("banned_emails" as any).select("id, reason").eq("email", email).maybeSingle();
      if (banned) {
        const reason = (banned as any).reason || "";
        toast.error(reason.includes("suspended") ? "This email is suspended." : "This email has been permanently banned.");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
      if (data.user) {
        setUserId(data.user.id);
        if (intent === "organizer") {
          await setupAsOrganizer(data.user.id);
          return;
        }
        setStep("choose-role");
      }
      toast.success("Account created!");
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const setupAsOrganizer = async (uid: string) => {
    setLoading(true);
    try {
      await supabase.from("organizer_profiles").insert({
        user_id: uid, organization_name: fullName.trim(), phone: phone.trim() || null,
        email: email.trim(), subscription_paid: false, subscription_plan: "free",
      });
      supabase.functions.invoke("send-welcome-email", {
        body: { fullName: fullName.trim(), email: email.trim(), phone: phone.trim() || null, organizationName: fullName.trim() },
      }).catch(() => {});
      toast.success("Welcome! Explore the organizer dashboard.");
      navigate("/organizer");
    } catch (err: any) {
      toast.error(err.message || "Failed to set up organizer account");
    } finally {
      setLoading(false);
    }
  };

  const setupAsAttendee = async (uid: string) => {
    setLoading(true);
    try {
      await supabase.from("attendee_accounts").insert({
        user_id: uid, full_name: fullName.trim(), email: email.trim(), phone: phone.trim() || null,
      } as any);
      await supabase.from("user_roles").insert({ user_id: uid, role: "attendee" } as any);
      supabase.functions.invoke("send-attendee-welcome", {
        body: { fullName: fullName.trim(), email: email.trim(), phone: phone.trim() || null },
      }).catch(() => {});
      toast.success("Welcome! Start exploring events.");
      navigate("/events");
    } catch (err: any) {
      toast.error(err.message || "Failed to set up account");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChoice = async (role: "explore" | "organize") => {
    if (!userId) return;
    if (role === "explore") await setupAsAttendee(userId);
    else await setupAsOrganizer(userId);
  };

  if (step === "choose-role") {
    return (
      <div className="min-h-screen bg-background">
        <SEO title="Sign In" description="Sign in or create your VERS account to manage events, register for events, and more." path="/auth" />
        <Navbar />
        <div className="flex min-h-[80vh] items-center justify-center px-4 pt-24 pb-16">
          <div className="w-full max-w-lg space-y-8 text-center">
            <div>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/30">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h1 className="font-display text-2xl font-bold text-foreground">What would you like to do?</h1>
              <p className="mt-2 text-sm text-muted-foreground">Choose how you'd like to use the platform. You can always change this later.</p>
            </div>
            <div className="grid gap-4">
              <button onClick={() => handleRoleChoice("explore")} disabled={loading}
                className="group relative flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-left transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                  <Search className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-foreground">Explore Events</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Browse, discover, and register for events. Save your favorites, RSVP faster, and keep track of your tickets.</p>
                </div>
                <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <button onClick={() => handleRoleChoice("organize")} disabled={loading}
                className="group relative flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-left transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                  <Calendar className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-foreground">Organize Events</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Create and manage events, track registrations, check in attendees, and access powerful analytics from your organizer dashboard.</p>
                </div>
                <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
            {loading && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Setting up your account...
              </div>
            )}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Sign In" description="Sign in or create your VERS account to manage events, register for events, and more." path="/auth" />
      <Navbar />
      <div className="flex min-h-[80vh] items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/30">
              <User className="h-6 w-6 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {mode === "login" ? "Welcome Back" : "Create Your Account"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "login" ? "Sign in to continue" : intent === "organizer" ? "Sign up to start creating and managing your events" : "Join to explore events, save favorites, and more"}
            </p>
          </div>
          {mode === "signup" ? (
            <form onSubmit={handleSignup} className="space-y-4 rounded-xl border border-border bg-card p-6">
              <div className="space-y-2">
                <Label className="text-xs">Full Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" className="pl-10 border-border bg-secondary" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="pl-10 border-border bg-secondary" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Phone (optional)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+251..." className="pl-10 border-border bg-secondary" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" className="pl-10 border-border bg-secondary" required minLength={6} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="flex items-start gap-3 rounded-lg border border-border bg-secondary/50 p-3 cursor-pointer hover:border-primary/50 transition-colors">
                  <Checkbox checked={tosAccepted} onCheckedChange={v => setTosAccepted(!!v)} className="mt-0.5" />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    I agree to the{" "}
                    <button type="button" onClick={e => { e.stopPropagation(); setShowTos(!showTos); }} className="text-primary underline hover:text-primary/80">Terms of Service</button>{" "}
                    and understand the platform's policies.
                  </span>
                </label>
                {showTos && (
                  <div className="rounded-lg border border-border bg-secondary p-4 text-xs text-muted-foreground space-y-2 max-h-48 overflow-y-auto">
                    <p className="font-semibold text-foreground">Terms of Service</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>You agree to provide accurate information during registration.</li>
                      <li>Event content must comply with local laws and regulations.</li>
                      <li>Organizer accounts require a paid subscription to create and manage events.</li>
                      <li><strong>No refunds</strong> will be issued for subscription payments.</li>
                      <li>The platform reserves the right to remove accounts that violate these terms.</li>
                      <li>You agree to receive platform-related email notifications.</li>
                    </ul>
                  </div>
                )}
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />} Create Account
              </Button>
              <p className="text-center text-sm text-muted-foreground pt-2">
                Already have an account?{" "}
                <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">Sign In</button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4 rounded-xl border border-border bg-card p-6">
              <div className="space-y-2">
                <Label className="text-xs">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="pl-10 border-border bg-secondary" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="pl-10 border-border bg-secondary" required />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />} Sign In
              </Button>
              <p className="text-center text-sm text-muted-foreground pt-2">
                Don't have an account?{" "}
                <button type="button" onClick={() => setMode("signup")} className="text-primary hover:underline">Sign Up</button>
              </p>
            </form>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Auth;

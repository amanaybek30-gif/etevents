import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, LogIn, Sparkles, AlertTriangle } from "lucide-react";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";

const OrganizerAuth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [showTos, setShowTos] = useState(false);
  const [subEnabled, setSubEnabled] = useState(false);

  useEffect(() => {
    const checkSub = async () => {
      const { data } = await supabase.from("platform_settings").select("key, value");
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(s => { map[s.key] = s.value; });
        if (map["subscription_enabled"] === "true") {
          setSubEnabled(true);
        }
      }
    };
    checkSub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // Check if user is banned (suspended or permanently removed)
        const { data: banned } = await supabase.from("banned_emails" as any).select("id, reason").eq("email", email).maybeSingle();
        if (banned) {
          const reason = (banned as any).reason || "";
          if (reason.includes("suspended")) {
            toast.error("Your account has been suspended for violating platform rules. Contact the admin for further information.");
          } else {
            toast.error("This account has been permanently removed from the platform. You cannot sign in.");
          }
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Check if organizer profile is suspended
        const { data: profile } = await supabase.from("organizer_profiles").select("is_suspended").eq("user_id", data.user.id).maybeSingle();
        if (profile?.is_suspended) {
          await supabase.auth.signOut();
          toast.error("Your account has been suspended. Contact the admin for further information.");
          setLoading(false);
          return;
        }

        toast.success("Signed in successfully!");
        navigate("/organizer");
      } else {
        if (!orgName.trim()) { toast.error("Name is required"); setLoading(false); return; }
        if (!tosAccepted) { toast.error("Please accept the Terms of Service"); setLoading(false); return; }

        // Check if email is banned (deactivated accounts can't sign up)
        const { data: banned } = await supabase.from("banned_emails" as any).select("id, reason").eq("email", email).maybeSingle();
        if (banned) {
          const reason = (banned as any).reason || "";
          if (reason.includes("deactivated")) {
            toast.error("This email has been permanently deactivated. You cannot sign up with this email.");
          } else if (reason.includes("suspended")) {
            toast.error("This email is associated with a suspended account. You cannot sign up until the suspension is lifted.");
          } else {
            toast.error("This email has been banned from the platform.");
          }
          setLoading(false);
          return;
        }
        
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        if (data.user) {
          const { error: profileError } = await supabase.from("organizer_profiles").insert({
            user_id: data.user.id,
            organization_name: orgName,
            phone, email,
            subscription_paid: false,
            subscription_plan: "free",
          });
          if (profileError) throw profileError;

          supabase.functions.invoke("send-welcome-email", {
            body: { fullName: orgName, email, phone, organizationName: orgName },
          }).catch(err => console.error("Welcome email failed:", err));
        }

        toast.success("Account created! Please choose your plan.");
        navigate("/organizer");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Organizer Sign In" description="Sign in or create an organizer account on VERS to start hosting and managing events." path="/organizer-auth" />
      <Navbar />
      <div className="flex min-h-[85vh] items-center justify-center px-4 pt-16">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <Sparkles className="mx-auto h-12 w-12 text-primary mb-4" />
            <h1 className="font-display text-3xl font-bold text-foreground">
              {isLogin ? "Welcome Back" : "Become an Organizer"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {isLogin ? "Sign in to your organizer dashboard" : "Create your organizer account to start hosting events"}
            </p>
          </div>


          <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-8">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="orgName">Name</Label>
                  <Input id="orgName" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Your full name" className="border-border bg-secondary" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+251..." className="border-border bg-secondary" />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="border-border bg-secondary" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="border-border bg-secondary" required />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <label className="flex items-start gap-3 rounded-lg border border-border bg-secondary/50 p-3 cursor-pointer hover:border-primary/50 transition-colors">
                  <Checkbox checked={tosAccepted} onCheckedChange={v => setTosAccepted(!!v)} className="mt-0.5" />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    I agree to the{" "}
                    <button type="button" onClick={e => { e.stopPropagation(); setShowTos(!showTos); }} className="text-primary underline hover:text-primary/80">
                      Terms of Service
                    </button>{" "}
                    and understand the platform's policies regarding subscriptions, payments, and usage.
                  </span>
                </label>

                {showTos && (
                  <div className="rounded-lg border border-border bg-secondary p-4 text-xs text-muted-foreground space-y-2 max-h-48 overflow-y-auto">
                    <p className="font-semibold text-foreground">Terms of Service</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>You agree to provide accurate information during registration.</li>
                      <li>Event content must comply with local laws and regulations.</li>
                      <li>A paid subscription is required to access the organizer dashboard.</li>
                      <li>Subscription plans are charged per event. Admin approval is required after payment.</li>
                      <li>Failure to pay will result in account suspension and inability to access the dashboard.</li>
                      <li><strong>No refunds</strong> will be issued for subscription payments under any circumstances.</li>
                      <li>Published events will go live immediately and are not subject to admin approval, but the admin reserves the right to suspend any event if violations are found.</li>
                      <li>Usage beyond your subscription plan limits (registrations, features) is strictly prohibited.</li>
                      <li>The platform reserves the right to permanently remove accounts that violate these terms.</li>
                      <li>You are responsible for managing your event registrations and attendee data.</li>
                      <li>You agree to receive platform-related email notifications.</li>
                      <li>Attendee data collected through the platform must be handled in compliance with applicable privacy laws.</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
              {isLogin ? "Sign In" : "Create Account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline">
                {isLogin ? "Sign Up" : "Sign In"}
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OrganizerAuth;

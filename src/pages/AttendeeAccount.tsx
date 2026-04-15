import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  User, Bookmark, Calendar, MapPin, ArrowRight, Trash2,
  LogOut, Settings, Loader2, Save, Sparkles,
} from "lucide-react";
import ConnectTelegramButton from "@/components/ConnectTelegramButton";

interface AttendeeProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  bio: string | null;
}

interface SavedEvent {
  id: string;
  event_id: string;
  event?: { id: string; title: string; slug: string; date: string; location: string; image_url: string | null; category: string };
}

const AttendeeAccount = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"saved" | "profile">("saved");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AttendeeProfile | null>(null);
  const [saved, setSaved] = useState<SavedEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [creatingOrg, setCreatingOrg] = useState(false);

  // Editable fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      setUserId(session.user.id);

      // Load profile
      const { data: prof } = await supabase
        .from("attendee_accounts")
        .select("id, full_name, email, phone, bio")
        .eq("user_id", session.user.id)
        .maybeSingle() as any;

      if (prof) {
        setProfile(prof);
        setFullName(prof.full_name);
        setPhone(prof.phone || "");
        setBio(prof.bio || "");
      }

      // Load saved events
      const { data: savedData } = await supabase
        .from("saved_events")
        .select("id, event_id")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (savedData && savedData.length > 0) {
        const eventIds = savedData.map(s => s.event_id);
        const { data: events } = await supabase
          .from("events")
          .select("id, title, slug, date, location, image_url, category")
          .in("id", eventIds);
        const evMap = Object.fromEntries((events || []).map(e => [e.id, e]));
        setSaved(savedData.map(s => ({ ...s, event: evMap[s.event_id] })));
      }

      setLoading(false);
    };
    load();
  }, [navigate]);

  const removeSaved = async (savedId: string) => {
    await supabase.from("saved_events").delete().eq("id", savedId);
    setSaved(prev => prev.filter(s => s.id !== savedId));
    toast.success("Event removed");
  };

  const updateProfile = async () => {
    if (!profile || !fullName.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("attendee_accounts")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", profile.id);
    if (error) toast.error("Failed to update");
    else toast.success("Profile updated");
    setSaving(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="My Account" description="Manage your VERS attendee profile, saved events, and account settings." path="/my-account" noindex />
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/30">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">{profile?.full_name || "My Account"}</h1>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} className="border-border text-muted-foreground hover:text-destructive hover:border-destructive">
            <LogOut className="mr-1 h-3 w-3" /> Sign Out
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg border border-border bg-secondary p-1 mb-6">
          <button
            onClick={() => setTab("saved")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${tab === "saved" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            <Bookmark className="h-4 w-4" /> Saved Events
          </button>
          <button
            onClick={() => setTab("profile")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${tab === "profile" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            <Settings className="h-4 w-4" /> My Profile
          </button>
        </div>

        {/* Content */}
        {tab === "saved" ? (
          saved.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <Bookmark className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">No saved events yet</p>
              <Button asChild size="sm"><Link to="/events">Browse Events</Link></Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {saved.map(s => s.event && (
                <div key={s.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  {s.event.image_url ? (
                    <img src={s.event.image_url} alt={s.event.title} className="h-36 w-full object-cover" />
                  ) : (
                    <div className="h-36 w-full bg-secondary" />
                  )}
                  <div className="p-4 space-y-2">
                    <span className="text-[10px] font-semibold text-primary uppercase">{s.event.category}</span>
                    <h3 className="font-display text-sm font-bold text-foreground">{s.event.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {s.event.date}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.event.location}</span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button asChild size="sm" className="flex-1 bg-gradient-gold text-primary-foreground hover:opacity-90">
                        <Link to={`/event/${s.event.slug}`}><ArrowRight className="mr-1 h-3 w-3" /> View</Link>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => removeSaved(s.id)} className="border-border hover:border-destructive hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs">Full Name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} className="border-border bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Email</Label>
              <Input value={profile?.email || ""} disabled className="border-border bg-secondary opacity-60" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Phone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+251..." className="border-border bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Bio</Label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={3}
                placeholder="Tell us about yourself..."
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button onClick={updateProfile} disabled={saving} className="bg-gradient-gold text-primary-foreground hover:opacity-90">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>

            {/* Telegram Connection */}
            <div className="pt-4 border-t border-border">
              <Label className="text-xs mb-2 block">Telegram Notifications</Label>
              <p className="text-[10px] text-muted-foreground mb-2">
                Connect Telegram to receive event reminders and updates
              </p>
              {userId && <ConnectTelegramButton userId={userId} role="explorer" />}
            </div>
          </div>
        )}

        {/* Organize Events CTA */}
        <div className="mt-8 rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">Want to host your own events?</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={creatingOrg}
            className="border-primary/30 text-primary hover:bg-primary/10 text-xs h-7"
            onClick={async () => {
              if (!userId || !profile) return;
              setCreatingOrg(true);
              try {
                // Check if organizer profile already exists
                const { data: existing } = await supabase
                  .from("organizer_profiles")
                  .select("id")
                  .eq("user_id", userId)
                  .maybeSingle();

                if (!existing) {
                  // Create organizer profile from explorer data
                  const { error } = await supabase.from("organizer_profiles").insert({
                    user_id: userId,
                    organization_name: profile.full_name,
                    phone: profile.phone,
                    email: profile.email,
                    subscription_paid: false,
                    subscription_plan: "free",
                  });
                  if (error) throw error;

                  // Send welcome email (same as new organizer signup)
                  supabase.functions.invoke("send-welcome-email", {
                    body: { fullName: profile.full_name, email: profile.email, phone: profile.phone || "", organizationName: profile.full_name },
                  }).catch(err => console.error("Welcome email failed:", err));
                }
                navigate("/organizer");
              } catch (err: any) {
                toast.error("Failed to set up organizer access: " + (err.message || "Unknown error"));
              }
              setCreatingOrg(false);
            }}
          >
            {creatingOrg ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Organize Events
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AttendeeAccount;

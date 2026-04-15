import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, Loader2, User, Globe, MapPin, Image as ImageIcon } from "lucide-react";

interface Props { userId: string; }

const OrganizerProfileEdit = ({ userId }: Props) => {
  const [profile, setProfile] = useState({
    organization_name: "", bio: "", website: "", city: "", country: "",
    event_categories: [] as string[], is_profile_public: true,
    social_links: { instagram: "", telegram: "", linkedin: "", twitter: "", facebook: "" },
    logo_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("organizer_profiles").select("*").eq("user_id", userId).single();
      if (data) {
        const d = data as any;
        setProfile({
          organization_name: d.organization_name || "",
          bio: d.bio || "",
          website: d.website || "",
          city: d.city || "",
          country: d.country || "",
          event_categories: d.event_categories || [],
          is_profile_public: d.is_profile_public ?? true,
          social_links: d.social_links || { instagram: "", telegram: "", linkedin: "", twitter: "", facebook: "" },
          logo_url: d.logo_url || "",
        });
      }
      setLoading(false);
    };
    fetch();
  }, [userId]);

  const update = (k: string, v: any) => setProfile(prev => ({ ...prev, [k]: v }));
  const updateSocial = (k: string, v: string) => setProfile(prev => ({ ...prev, social_links: { ...prev.social_links, [k]: v } }));

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Logo must be under 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}/logo.${ext}`;
    const { error } = await supabase.storage.from("event-posters").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("event-posters").getPublicUrl(path);
    update("logo_url", urlData.publicUrl);
    setUploading(false);
    toast.success("Logo uploaded!");
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("organizer_profiles").update({
      organization_name: profile.organization_name,
      bio: profile.bio,
      website: profile.website,
      city: profile.city,
      country: profile.country,
      event_categories: profile.event_categories,
      is_profile_public: profile.is_profile_public,
      social_links: profile.social_links,
      logo_url: profile.logo_url,
    } as any).eq("user_id", userId);
    if (error) toast.error("Failed to save profile");
    else toast.success("Profile saved!");
    setSaving(false);
  };

  const CATEGORIES = ["Business", "Technology", "Youth Programs", "Cultural", "Music", "Fashion", "Sports", "Charity", "Education", "Other"];

  if (loading) return <div className="flex justify-center py-12 text-muted-foreground">Loading...</div>;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h3 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
        <User className="h-5 w-5 text-primary" /> Public Profile
      </h3>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Visibility</h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{profile.is_profile_public ? "Public" : "Hidden"}</span>
            <Switch checked={profile.is_profile_public} onCheckedChange={v => update("is_profile_public", v)} />
          </div>
        </div>
      </div>

      {/* Logo */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Logo / Profile Image</h4>
        <div className="flex items-center gap-4">
          {profile.logo_url ? (
            <img src={profile.logo_url} alt="Logo" className="h-16 w-16 rounded-full object-cover border border-border" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center border border-border">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div>
            <label className="cursor-pointer text-sm text-primary hover:underline">
              {uploading ? "Uploading..." : "Upload Logo"}
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={uploading} />
            </label>
            <p className="text-xs text-muted-foreground">Max 5MB. JPG, PNG</p>
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Basic Information</h4>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Organization Name</Label>
            <Input value={profile.organization_name} onChange={e => update("organization_name", e.target.value)} className="border-border bg-secondary" />
          </div>
          <div className="space-y-2">
            <Label>Bio / Description</Label>
            <Textarea value={profile.bio} onChange={e => update("bio", e.target.value)} placeholder="Tell attendees about your organization..." className="border-border bg-secondary min-h-[80px]" />
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input value={profile.website} onChange={e => update("website", e.target.value)} placeholder="https://..." className="border-border bg-secondary" />
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <MapPin className="h-4 w-4" /> Location
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={profile.city} onChange={e => update("city", e.target.value)} className="border-border bg-secondary" />
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Input value={profile.country} onChange={e => update("country", e.target.value)} className="border-border bg-secondary" />
          </div>
        </div>
      </div>

      {/* Event Categories */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Event Categories</h4>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => update("event_categories", profile.event_categories.includes(cat) ? profile.event_categories.filter(c => c !== cat) : [...profile.event_categories, cat])}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
                profile.event_categories.includes(cat)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:border-primary/50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Social Links */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Globe className="h-4 w-4" /> Social Media
        </h4>
        <div className="space-y-3">
          {[
            { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/..." },
            { key: "telegram", label: "Telegram", placeholder: "https://t.me/..." },
            { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/..." },
            { key: "twitter", label: "X (Twitter)", placeholder: "https://x.com/..." },
            { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/..." },
          ].map(s => (
            <div key={s.key} className="space-y-1">
              <Label className="text-xs">{s.label}</Label>
              <Input value={(profile.social_links as any)[s.key] || ""} onChange={e => updateSocial(s.key, e.target.value)} placeholder={s.placeholder} className="border-border bg-secondary" />
            </div>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save Profile
      </Button>
    </div>
  );
};

export default OrganizerProfileEdit;

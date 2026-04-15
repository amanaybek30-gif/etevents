import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ToggleLeft, Users, Bookmark, Share2, Store } from "lucide-react";

interface Props { adminId: string; }

const FEATURES = [
  { key: "feature_organizer_profiles", label: "Organizer Profiles", desc: "Allow organizers to have a public profile page displaying their info and events.", icon: Users },
  { key: "feature_save_events", label: "Save Events", desc: "Allow visitors to bookmark/save events to their dashboard.", icon: Bookmark },
  { key: "feature_share_events", label: "Share Events", desc: "Show share buttons (WhatsApp, Telegram, Facebook, Email) on event pages.", icon: Share2 },
  { key: "feature_vendor_registration", label: "Vendor Registration", desc: "Allow organizers to accept vendor/exhibitor applications for their events.", icon: Store },
];

const AdminFeatureControls = ({ adminId }: Props) => {
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("platform_settings").select("key, value");
      if (data) {
        const map: Record<string, boolean> = {};
        data.forEach(s => { if (s.key.startsWith("feature_")) map[s.key] = s.value === "true"; });
        setSettings(map);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const toggle = async (key: string) => {
    const newVal = !settings[key];
    const { error } = await supabase.from("platform_settings").update({ value: newVal ? "true" : "false", updated_at: new Date().toISOString() }).eq("key", key);
    if (error) {
      // Key might not exist yet
      await supabase.from("platform_settings").insert({ key, value: newVal ? "true" : "false" });
    }
    await supabase.from("admin_logs").insert({
      admin_id: adminId, action: `toggled ${key} ${newVal ? "ON" : "OFF"}`,
      target_type: "feature", target_id: key, details: newVal ? "enabled" : "disabled",
    });
    setSettings(prev => ({ ...prev, [key]: newVal }));
    toast.success(`${FEATURES.find(f => f.key === key)?.label} ${newVal ? "enabled" : "disabled"}`);
  };

  if (loading) return <div className="flex justify-center py-12 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <ToggleLeft className="h-6 w-6 text-primary" /> Feature Controls
      </h1>
      <p className="text-sm text-muted-foreground">Enable or disable platform features globally. Disabled features are hidden across the entire platform.</p>

      <div className="mx-auto max-w-xl space-y-4">
        {FEATURES.map(f => (
          <div key={f.key} className="rounded-xl border border-border bg-card p-4 sm:p-5 flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
              <f.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">{f.label}</h3>
                <Switch checked={!!settings[f.key]} onCheckedChange={() => toggle(f.key)} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminFeatureControls;

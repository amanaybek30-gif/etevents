import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Settings, CreditCard, Loader2, Trash2 } from "lucide-react";

interface Props { adminId: string; }

const PAYMENT_METHODS = [
  { id: "bank_transfer", label: "Bank Transfer" },
  { id: "telebirr", label: "Telebirr" },
  { id: "mpessa", label: "Mpessa" },
];

const AdminSettings = ({ adminId }: Props) => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingSub, setSavingSub] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from("platform_settings").select("key, value");
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(s => { map[s.key] = s.value; });
      setSettings(map);
    }
    setLoading(false);
  };

  const saveSetting = async (key: string, value: string) => {
    const { error } = await supabase.from("platform_settings").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
    if (error) {
      const { error: insertErr } = await supabase.from("platform_settings").insert({ key, value });
      if (insertErr) { toast.error("Failed to save"); return; }
    }
    await supabase.from("admin_logs").insert({ admin_id: adminId, action: `updated setting ${key}`, target_type: "setting", target_id: key, details: value });
    toast.success("Setting saved");
  };

  const subscriptionEnabled = settings["subscription_enabled"] === "true";

  const toggleSubscription = async () => {
    const newVal = subscriptionEnabled ? "false" : "true";
    if (newVal === "true") {
      const methods = parseJSON(settings["subscription_payment_methods"], []);
      if (!methods.length) { toast.error("Please configure payment methods before enabling subscription"); return; }
    }
    await saveSetting("subscription_enabled", newVal);
    setSettings(prev => ({ ...prev, subscription_enabled: newVal }));
  };

  const parseJSON = (str: string | undefined, fallback: any) => { try { return str ? JSON.parse(str) : fallback; } catch { return fallback; } };

  const subPaymentMethods: string[] = parseJSON(settings["subscription_payment_methods"], []);
  const subPaymentDetails: Record<string, any> = parseJSON(settings["subscription_payment_details"], {});

  const toggleSubPaymentMethod = (id: string) => {
    const updated = subPaymentMethods.includes(id) ? subPaymentMethods.filter(m => m !== id) : [...subPaymentMethods, id];
    setSettings(prev => ({ ...prev, subscription_payment_methods: JSON.stringify(updated) }));
  };

  const updateSubPaymentDetail = (key: string, value: string) => {
    const updated = { ...subPaymentDetails, [key]: value };
    setSettings(prev => ({ ...prev, subscription_payment_details: JSON.stringify(updated) }));
  };

  const saveSubscriptionSettings = async () => {
    setSavingSub(true);
    await Promise.all([
      saveSetting("subscription_grace_days", settings["subscription_grace_days"] || "7"),
      saveSetting("subscription_payment_methods", settings["subscription_payment_methods"] || "[]"),
      saveSetting("subscription_payment_details", settings["subscription_payment_details"] || "{}"),
    ]);
    setSavingSub(false);
    toast.success("Subscription settings saved");
  };

  const settingFields = [
    { key: "platform_fee_percent", label: "Platform Fee (%)", placeholder: "5" },
    { key: "payment_bank_name", label: "Bank Name", placeholder: "Commercial Bank of Ethiopia" },
    { key: "payment_account_number", label: "Bank Account Number", placeholder: "1000XXXXXXXX" },
    { key: "payment_telebirr_number", label: "Telebirr Number", placeholder: "+251..." },
    { key: "support_email", label: "Support Email", placeholder: "support@etevents.com" },
  ];

  if (loading) return <div className="flex justify-center py-12 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" /> Settings
      </h1>

      <div className="mx-auto max-w-xl space-y-6">
        {/* Subscription Section */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Organizer Subscription
              </h3>
              <p className="text-xs text-muted-foreground mt-1">When enabled, organizers must pay per event to access the platform</p>
            </div>
            <Switch checked={subscriptionEnabled} onCheckedChange={toggleSubscription} />
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-1">
              <p className="text-xs font-semibold text-foreground">Plans (Per Event)</p>
              <p className="text-xs text-muted-foreground">Organizer: 1,800 ETB (500 regs) · Pro: 6,500 ETB (1,500 regs) · Corporate: 10,500 ETB/month (unlimited)</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Grace Period (days)</Label>
              <Input value={settings["subscription_grace_days"] || ""} onChange={e => setSettings(prev => ({ ...prev, subscription_grace_days: e.target.value }))} placeholder="7" type="number" className="border-border bg-secondary" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Accepted Payment Methods</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {PAYMENT_METHODS.map(pm => (
                  <label key={pm.id} className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors text-sm ${subPaymentMethods.includes(pm.id) ? "border-primary bg-primary/5" : "border-border bg-secondary hover:border-primary/50"}`}>
                    <Checkbox checked={subPaymentMethods.includes(pm.id)} onCheckedChange={() => toggleSubPaymentMethod(pm.id)} />
                    <span className="font-medium text-foreground">{pm.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {subPaymentMethods.includes("bank_transfer") && (
              <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-3">
                <p className="text-xs font-semibold text-foreground">Bank Transfer Details</p>
                <Input placeholder="Bank Name" value={subPaymentDetails.bankName || ""} onChange={e => updateSubPaymentDetail("bankName", e.target.value)} className="border-border bg-secondary" />
                <Input placeholder="Account Number" value={subPaymentDetails.bankAccount || ""} onChange={e => updateSubPaymentDetail("bankAccount", e.target.value)} className="border-border bg-secondary" />
                <Input placeholder="Account Holder Name" value={subPaymentDetails.bankHolder || ""} onChange={e => updateSubPaymentDetail("bankHolder", e.target.value)} className="border-border bg-secondary" />
              </div>
            )}

            {subPaymentMethods.includes("telebirr") && (
              <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-3">
                <p className="text-xs font-semibold text-foreground">Telebirr Details</p>
                <Input placeholder="Full Name" value={subPaymentDetails.telebirrName || ""} onChange={e => updateSubPaymentDetail("telebirrName", e.target.value)} className="border-border bg-secondary" />
                <Input placeholder="Phone Number" value={subPaymentDetails.telebirrPhone || ""} onChange={e => updateSubPaymentDetail("telebirrPhone", e.target.value)} className="border-border bg-secondary" />
              </div>
            )}

            {subPaymentMethods.includes("mpessa") && (
              <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-3">
                <p className="text-xs font-semibold text-foreground">Mpessa Details</p>
                <Input placeholder="Full Name" value={subPaymentDetails.mpessaName || ""} onChange={e => updateSubPaymentDetail("mpessaName", e.target.value)} className="border-border bg-secondary" />
                <Input placeholder="Phone Number" value={subPaymentDetails.mpessaPhone || ""} onChange={e => updateSubPaymentDetail("mpessaPhone", e.target.value)} className="border-border bg-secondary" />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Payment Instructions</Label>
              <Textarea value={subPaymentDetails.instructions || ""} onChange={e => updateSubPaymentDetail("instructions", e.target.value)} placeholder="e.g. Send payment and share receipt via email..." className="border-border bg-secondary min-h-[60px]" />
            </div>

            <Button onClick={saveSubscriptionSettings} disabled={savingSub} className="w-full">
              {savingSub ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Subscription Settings
            </Button>
          </div>
        </div>

        {/* Sample Events Toggle */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Show Sample Events</h3>
              <p className="text-xs text-muted-foreground mt-1">Display sample/demo events on the public homepage and events page</p>
            </div>
            <Switch
              checked={settings["show_sample_events"] === "true"}
              onCheckedChange={async () => {
                const newVal = settings["show_sample_events"] === "true" ? "false" : "true";
                await saveSetting("show_sample_events", newVal);
                setSettings(prev => ({ ...prev, show_sample_events: newVal }));
              }}
            />
          </div>
        </div>

        {/* Cleanup Orphaned Auth Records */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-destructive" /> Cleanup Orphaned Users
          </h3>
          <p className="text-xs text-muted-foreground">
            Removes authentication records for users who are no longer listed as organizers or explorers. This prevents old/deleted accounts from blocking email re-registration. Admin accounts are always preserved.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={cleaning}
            onClick={async () => {
              setCleaning(true);
              try {
                const { data, error } = await supabase.functions.invoke("admin-cleanup-users");
                if (error) throw error;
                if (data?.error) throw new Error(data.error);
                toast.success(`Cleanup complete: ${data.deleted} orphaned record(s) removed out of ${data.orphaned_found} found.`);
                await supabase.from("admin_logs").insert({
                  admin_id: adminId,
                  action: "cleanup_orphaned_users",
                  target_type: "auth",
                  details: `Deleted ${data.deleted} orphaned auth records`,
                });
              } catch (err: any) {
                toast.error("Cleanup failed: " + (err.message || "Unknown error"));
              }
              setCleaning(false);
            }}
            className="border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            {cleaning ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-2 h-3.5 w-3.5" />}
            {cleaning ? "Cleaning up..." : "Run Cleanup"}
          </Button>
        </div>

        {/* General Settings */}
        {settingFields.map(f => (
          <div key={f.key} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <Label className="text-sm font-medium">{f.label}</Label>
            <div className="flex gap-2">
              <Input value={settings[f.key] || ""} onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder} className="border-border bg-secondary" />
              <Button size="sm" onClick={() => saveSetting(f.key, settings[f.key] || "")} className="shrink-0"><Save className="h-3 w-3" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminSettings;

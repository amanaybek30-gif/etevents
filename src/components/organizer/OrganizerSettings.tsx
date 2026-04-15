import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Loader2, Plus, X, Lock, KeyRound } from "lucide-react";

const BANKS = ["Commercial Bank of Ethiopia", "Bank of Abyssinia", "Dashen Bank", "Awash Bank", "Other"];

interface BankPaymentInfo { bank: string; otherBank?: string; accountNumber: string; accountName: string; }
interface MobilePaymentInfo { name: string; phone: string; }
export interface SavedPaymentDetails {
  acceptedMethods: string[];
  bankTransfer?: BankPaymentInfo[];
  telebirr?: MobilePaymentInfo;
  mpessa?: MobilePaymentInfo;
}

interface Props {
  userId: string;
}

const OrganizerSettings = ({ userId }: Props) => {
  const [profile, setProfile] = useState({ organization_name: "", phone: "" });
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [acceptedMethods, setAcceptedMethods] = useState<string[]>([]);
  const [bankPayments, setBankPayments] = useState<BankPaymentInfo[]>([{ bank: "", otherBank: "", accountNumber: "", accountName: "" }]);
  const [telebirrInfo, setTelebirrInfo] = useState<MobilePaymentInfo>({ name: "", phone: "" });
  const [mpessaInfo, setMpessaInfo] = useState<MobilePaymentInfo>({ name: "", phone: "" });

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const togglePayment = (id: string) => setAcceptedMethods(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setEmail(user.email || "");
      const { data } = await supabase.from("organizer_profiles").select("*").eq("user_id", userId).single();
      if (data) {
        setProfile({
          organization_name: data.organization_name || "",
          phone: data.phone || "",
        });
        if (data.payment_details) {
          try {
            const parsed: SavedPaymentDetails = JSON.parse(data.payment_details);
            if (parsed.acceptedMethods) setAcceptedMethods(parsed.acceptedMethods);
            if (parsed.bankTransfer?.length) setBankPayments(parsed.bankTransfer);
            if (parsed.telebirr) setTelebirrInfo(parsed.telebirr);
            if (parsed.mpessa) setMpessaInfo(parsed.mpessa);
          } catch { /* Legacy plain text — ignore */ }
        }
      }
      setLoading(false);
    };
    fetch();
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    const paymentDetails: SavedPaymentDetails = { acceptedMethods };
    if (acceptedMethods.includes("bank_transfer")) paymentDetails.bankTransfer = bankPayments.filter(b => b.bank || b.accountNumber);
    if (acceptedMethods.includes("telebirr")) paymentDetails.telebirr = telebirrInfo;
    if (acceptedMethods.includes("mpessa")) paymentDetails.mpessa = mpessaInfo;

    const { error } = await supabase.from("organizer_profiles").update({
      organization_name: profile.organization_name,
      phone: profile.phone,
      payment_details: JSON.stringify(paymentDetails),
    }).eq("user_id", userId);
    if (error) toast.error("Failed to save");
    else toast.success("Settings saved!");
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!currentPassword) { toast.error("Please enter your current password"); return; }
    if (!newPassword || !confirmPassword) { toast.error("Please fill in all password fields"); return; }
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }

    setChangingPassword(true);

    // First verify the old password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      toast.error("Current password is incorrect");
      setChangingPassword(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message || "Failed to change password");
    } else {
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);

      // Send password changed notification email
      try {
        const { data: profileData } = await supabase.from("organizer_profiles").select("organization_name").eq("user_id", userId).single();
        await supabase.functions.invoke("send-password-changed-email", {
          body: { email, fullName: profileData?.organization_name || email },
        });
      } catch { /* best effort */ }
    }
    setChangingPassword(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Profile */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Profile</h3>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={profile.organization_name} onChange={e => setProfile({ ...profile, organization_name: e.target.value })} className="border-border bg-secondary" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} readOnly className="border-border bg-secondary text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="09XXXXXXXX" className="border-border bg-secondary" />
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Lock className="h-4 w-4" /> Security
        </h3>

        {!showPasswordForm ? (
          <Button onClick={() => setShowPasswordForm(true)} variant="outline" className="w-full border-border hover:border-primary hover:text-primary">
            <KeyRound className="mr-2 h-4 w-4" /> Change Your Password
          </Button>
        ) : (
          <div className="space-y-3 rounded-lg border border-border bg-secondary/50 p-4">
            <p className="text-sm text-muted-foreground">Enter your current password and choose a new one.</p>
            <div className="space-y-2">
              <Label>Current Password *</Label>
              <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" className="border-border bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label>New Password *</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" className="border-border bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password *</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="border-border bg-secondary" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowPasswordForm(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }} className="flex-1 border-border">
                Cancel
              </Button>
              <Button onClick={handleChangePassword} disabled={changingPassword} className="flex-1 bg-gradient-gold text-primary-foreground hover:opacity-90">
                {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                Update Password
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Settings — Structured */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Default Payment Methods</h3>
        <p className="text-xs text-muted-foreground">These will be auto-filled when you create a new event. You can change them per event.</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[{ id: "bank_transfer", label: "Bank Transfer" }, { id: "telebirr", label: "Telebirr" }, { id: "mpessa", label: "Mpessa" }].map(pm => (
            <label key={pm.id} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${acceptedMethods.includes(pm.id) ? "border-primary bg-primary/5" : "border-border bg-secondary hover:border-primary/50"}`}>
              <Checkbox checked={acceptedMethods.includes(pm.id)} onCheckedChange={() => togglePayment(pm.id)} />
              <span className="text-sm font-medium text-foreground">{pm.label}</span>
            </label>
          ))}
        </div>

        {acceptedMethods.includes("bank_transfer") && (
          <div className="space-y-3 rounded-lg border border-border bg-secondary/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Bank Transfer Details</p>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBankPayments([...bankPayments, { bank: "", otherBank: "", accountNumber: "", accountName: "" }])}>
                <Plus className="h-3 w-3 mr-1" /> Add Bank
              </Button>
            </div>
            {bankPayments.map((bp, idx) => (
              <div key={idx} className="space-y-2 rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Bank #{idx + 1}</span>
                  {bankPayments.length > 1 && <button type="button" onClick={() => setBankPayments(bankPayments.filter((_, i) => i !== idx))} className="text-destructive"><X className="h-4 w-4" /></button>}
                </div>
                <Select value={bp.bank} onValueChange={v => { const u = [...bankPayments]; u[idx].bank = v; setBankPayments(u); }}>
                  <SelectTrigger className="border-border bg-secondary h-9"><SelectValue placeholder="Select bank" /></SelectTrigger>
                  <SelectContent>{BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
                {bp.bank === "Other" && <Input placeholder="Bank name" value={bp.otherBank} onChange={e => { const u = [...bankPayments]; u[idx].otherBank = e.target.value; setBankPayments(u); }} className="border-border bg-secondary" />}
                <Input placeholder="Account Number" value={bp.accountNumber} onChange={e => { const u = [...bankPayments]; u[idx].accountNumber = e.target.value; setBankPayments(u); }} className="border-border bg-secondary" />
                <Input placeholder="Account Name" value={bp.accountName} onChange={e => { const u = [...bankPayments]; u[idx].accountName = e.target.value; setBankPayments(u); }} className="border-border bg-secondary" />
              </div>
            ))}
          </div>
        )}

        {acceptedMethods.includes("telebirr") && (
          <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-4">
            <p className="text-sm font-semibold text-foreground">Telebirr Details</p>
            <Input placeholder="Full Name" value={telebirrInfo.name} onChange={e => setTelebirrInfo({ ...telebirrInfo, name: e.target.value })} className="border-border bg-secondary" />
            <Input placeholder="Phone Number" value={telebirrInfo.phone} onChange={e => setTelebirrInfo({ ...telebirrInfo, phone: e.target.value })} className="border-border bg-secondary" />
          </div>
        )}

        {acceptedMethods.includes("mpessa") && (
          <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-4">
            <p className="text-sm font-semibold text-foreground">Mpessa Details</p>
            <Input placeholder="Full Name" value={mpessaInfo.name} onChange={e => setMpessaInfo({ ...mpessaInfo, name: e.target.value })} className="border-border bg-secondary" />
            <Input placeholder="Phone Number" value={mpessaInfo.phone} onChange={e => setMpessaInfo({ ...mpessaInfo, phone: e.target.value })} className="border-border bg-secondary" />
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save Settings
      </Button>
    </div>
  );
};

export default OrganizerSettings;

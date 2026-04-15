import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Store, Loader2, CheckCircle, Package, DollarSign } from "lucide-react";

interface VendorPackage {
  id: string;
  name: string;
  pricing_type: string;
  price: string;
  unit?: string;
  description?: string;
  includes?: string;
}

interface Props {
  eventId: string;
  eventTitle: string;
  vendorPricing?: VendorPackage[] | null;
}

const VENDOR_TYPES = [
  "Food & Beverage", "Merchandise", "Exhibitor", "Sponsor Booth",
  "Technology", "Art & Craft", "Health & Wellness", "Other",
];

const PRICING_TYPE_LABELS: Record<string, string> = {
  per_sqm: "Per Square Meter",
  table_chair: "Table & Chair",
  shell_scheme: "Shell Scheme",
  flat_rate: "Flat Rate",
  custom: "Custom",
};

const VendorRegistrationForm = ({ eventId, eventTitle, vendorPricing }: Props) => {
  const [form, setForm] = useState({
    vendor_name: "", brand_name: "", contact_person: "", phone: "", email: "",
    vendor_type: "Exhibitor", description: "", website: "", booth_size: "",
    power_required: false, special_requirements: "",
  });
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const packages = Array.isArray(vendorPricing) ? vendorPricing : [];
  const selectedPkg = packages.find(p => p.id === selectedPackageId);

  const update = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    if (!form.vendor_name.trim() || !form.contact_person.trim() || !form.phone.trim() || !form.email.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (packages.length > 0 && !selectedPackageId) {
      toast.error("Please select a booth package");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("vendor_registrations").insert({
      event_id: eventId,
      vendor_name: form.vendor_name.trim(),
      brand_name: form.brand_name.trim() || null,
      contact_person: form.contact_person.trim(),
      phone: form.phone.trim(),
      email: form.email.trim().toLowerCase(),
      vendor_type: form.vendor_type,
      description: form.description.trim() || null,
      website: form.website.trim() || null,
      booth_size: form.booth_size.trim() || null,
      power_required: form.power_required,
      special_requirements: form.special_requirements.trim() || null,
      selected_package: selectedPkg?.name || null,
      selected_package_price: selectedPkg?.price || null,
    } as any);

    if (error) {
      toast.error("Failed to submit application");
      console.error(error);
    } else {
      setSubmitted(true);
      toast.success("Vendor application submitted!");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="text-center py-12 space-y-4">
        <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
        <h3 className="font-display text-xl font-bold text-foreground">Application Submitted!</h3>
        <p className="text-muted-foreground">Your vendor application for <strong>{eventTitle}</strong> has been received. The organizer will review and contact you.</p>
        {selectedPkg && (
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
            <Package className="h-4 w-4" />
            {selectedPkg.name} — {selectedPkg.price} ETB
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <Store className="mx-auto h-8 w-8 text-primary" />
        <h2 className="font-display text-2xl font-bold text-foreground">Vendor Registration</h2>
        <p className="text-muted-foreground">Apply to be a vendor at <strong>{eventTitle}</strong></p>
      </div>

      <div className="mx-auto max-w-lg space-y-6">
        {/* Booth Packages */}
        {packages.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> Select Booth Package *
            </h3>
            <div className="space-y-3">
              {packages.map(pkg => (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedPackageId(pkg.id)}
                  className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                    selectedPackageId === pkg.id
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-secondary/50 hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <p className="font-semibold text-foreground">{pkg.name}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                          {PRICING_TYPE_LABELS[pkg.pricing_type] || pkg.pricing_type}
                        </span>
                        {pkg.unit && pkg.pricing_type !== "flat_rate" && (
                          <span className="text-xs text-muted-foreground">{pkg.unit}</span>
                        )}
                      </div>
                      {pkg.description && (
                        <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>
                      )}
                      {pkg.includes && (
                        <div className="mt-2">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Includes:</p>
                          <p className="text-xs text-foreground/80">{pkg.includes}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-display text-lg font-bold text-primary">{pkg.price}</p>
                      <p className="text-[10px] text-muted-foreground">ETB</p>
                    </div>
                  </div>
                  {selectedPackageId === pkg.id && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-primary font-semibold">
                      <CheckCircle className="h-3.5 w-3.5" /> Selected
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Vendor Info */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Vendor Information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Vendor Name *</Label>
              <Input value={form.vendor_name} onChange={e => update("vendor_name", e.target.value)} className="border-border bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label>Business / Brand Name</Label>
              <Input value={form.brand_name} onChange={e => update("brand_name", e.target.value)} className="border-border bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label>Contact Person *</Label>
              <Input value={form.contact_person} onChange={e => update("contact_person", e.target.value)} className="border-border bg-secondary" />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="+251..." className="border-border bg-secondary" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => update("email", e.target.value)} className="border-border bg-secondary" />
            </div>
          </div>
        </div>

        {/* Business Details */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Business Details</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type of Vendor *</Label>
              <Select value={form.vendor_type} onValueChange={v => update("vendor_type", v)}>
                <SelectTrigger className="border-border bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VENDOR_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description of Products / Services</Label>
              <Textarea value={form.description} onChange={e => update("description", e.target.value)} className="border-border bg-secondary min-h-[80px]" />
            </div>
            <div className="space-y-2">
              <Label>Website or Social Media Link</Label>
              <Input value={form.website} onChange={e => update("website", e.target.value)} placeholder="https://..." className="border-border bg-secondary" />
            </div>
          </div>
        </div>

        {/* Event Participation */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Event Participation</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Booth Size Requested</Label>
              <Input value={form.booth_size} onChange={e => update("booth_size", e.target.value)} placeholder="e.g., 3m x 3m" className="border-border bg-secondary" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.power_required} onCheckedChange={v => update("power_required", v)} />
              <Label>Power / Electricity Required</Label>
            </div>
            <div className="space-y-2">
              <Label>Special Requirements</Label>
              <Textarea value={form.special_requirements} onChange={e => update("special_requirements", e.target.value)} className="border-border bg-secondary min-h-[60px]" />
            </div>
          </div>
        </div>

        {/* Summary */}
        {selectedPkg && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Selected: {selectedPkg.name}</p>
              <p className="text-xs text-muted-foreground">{PRICING_TYPE_LABELS[selectedPkg.pricing_type] || selectedPkg.pricing_type}</p>
            </div>
            <p className="font-display text-lg font-bold text-primary">{selectedPkg.price} ETB</p>
          </div>
        )}

        <Button onClick={handleSubmit} disabled={submitting} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90 py-6 text-lg">
          {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Store className="mr-2 h-5 w-5" />}
          Submit Application
        </Button>
      </div>
    </div>
  );
};

export default VendorRegistrationForm;

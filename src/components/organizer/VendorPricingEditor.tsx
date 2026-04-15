import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, DollarSign } from "lucide-react";

export interface VendorPackage {
  id: string;
  name: string;
  pricing_type: string; // "per_sqm" | "table_chair" | "shell_scheme" | "flat_rate" | "custom"
  price: string;
  unit?: string; // e.g. "per sqm", "per table", etc.
  description?: string;
  includes?: string;
}

const PRICING_TYPES = [
  { value: "per_sqm", label: "Per Square Meter", unit: "per sqm" },
  { value: "table_chair", label: "Table & Chair", unit: "per set" },
  { value: "shell_scheme", label: "Shell Scheme", unit: "per booth" },
  { value: "flat_rate", label: "Flat Rate", unit: "fixed" },
  { value: "custom", label: "Custom Package", unit: "" },
];

interface Props {
  packages: VendorPackage[];
  onChange: (packages: VendorPackage[]) => void;
}

const VendorPricingEditor = ({ packages, onChange }: Props) => {
  const addPackage = () => {
    onChange([
      ...packages,
      {
        id: crypto.randomUUID(),
        name: "",
        pricing_type: "flat_rate",
        price: "",
        unit: "fixed",
        description: "",
        includes: "",
      },
    ]);
  };

  const updatePackage = (index: number, field: string, value: string) => {
    const updated = [...packages];
    (updated[index] as any)[field] = value;
    if (field === "pricing_type") {
      const pt = PRICING_TYPES.find(p => p.value === value);
      updated[index].unit = pt?.unit || "";
    }
    onChange(updated);
  };

  const removePackage = (index: number) => {
    onChange(packages.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Vendor Booth Packages</h3>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addPackage} className="h-8 border-border text-xs">
          <Plus className="h-3 w-3 mr-1" /> Add Package
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Define pricing packages for vendors. They'll choose one when applying.
      </p>

      {packages.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No packages yet. Add one to set vendor pricing.</p>
        </div>
      )}

      {packages.map((pkg, i) => (
        <div key={pkg.id} className="rounded-lg border border-border bg-secondary/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Package #{i + 1}</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => removePackage(i)} className="h-7 text-destructive hover:text-destructive/80">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Package Name *</Label>
              <Input
                value={pkg.name}
                onChange={e => updatePackage(i, "name", e.target.value)}
                placeholder="e.g., Standard Booth"
                className="border-border bg-background h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pricing Type</Label>
              <Select value={pkg.pricing_type} onValueChange={v => updatePackage(i, "pricing_type", v)}>
                <SelectTrigger className="border-border bg-background h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRICING_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Price (ETB) *</Label>
              <Input
                value={pkg.price}
                onChange={e => updatePackage(i, "price", e.target.value)}
                placeholder="e.g., 5000"
                className="border-border bg-background h-9 text-sm"
              />
            </div>
            {pkg.pricing_type === "custom" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Unit Label</Label>
                <Input
                  value={pkg.unit || ""}
                  onChange={e => updatePackage(i, "unit", e.target.value)}
                  placeholder="e.g., per day, per booth"
                  className="border-border bg-background h-9 text-sm"
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">What's Included</Label>
            <Textarea
              value={pkg.includes || ""}
              onChange={e => updatePackage(i, "includes", e.target.value)}
              placeholder="e.g., 1 table, 2 chairs, electricity, signage..."
              className="border-border bg-background min-h-[50px] text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input
              value={pkg.description || ""}
              onChange={e => updatePackage(i, "description", e.target.value)}
              placeholder="Brief description of this package"
              className="border-border bg-background h-9 text-sm"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default VendorPricingEditor;

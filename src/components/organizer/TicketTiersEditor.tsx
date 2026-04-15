import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Image as ImageIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TicketTier {
  id: string;
  name: string;
  price: string;
  description: string;
  ticket_image_url?: string;
}

interface Props {
  tiers: TicketTier[];
  onChange: (tiers: TicketTier[]) => void;
}

const PRESET_TIERS = ["Regular", "VIP", "VVIP", "Early Bird"];

const TicketTiersEditor = ({ tiers, onChange }: Props) => {
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const addTier = (preset?: string) => {
    onChange([...tiers, {
      id: `tier_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: preset || "",
      price: "",
      description: "",
      ticket_image_url: "",
    }]);
  };

  const updateTier = (idx: number, updates: Partial<TicketTier>) => {
    onChange(tiers.map((t, i) => i === idx ? { ...t, ...updates } : t));
  };

  const removeTier = (idx: number) => {
    onChange(tiers.filter((_, i) => i !== idx));
  };

  const handleTicketImageUpload = async (idx: number, file: File) => {
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPG, PNG, or WebP images are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ticket image must be under 10MB");
      return;
    }
    const ext = file.name.split(".").pop();
    const path = `ticket-${tiers[idx].id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("event-posters").upload(path, file, { upsert: true });
    if (error) {
      toast.error("Failed to upload ticket image");
      return;
    }
    const { data: urlData } = supabase.storage.from("event-posters").getPublicUrl(path);
    updateTier(idx, { ticket_image_url: urlData.publicUrl });
    toast.success("Ticket image uploaded!");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Ticket Tiers</h3>
          <p className="text-xs text-muted-foreground mt-1">Optional. Add different ticket types with varying prices.</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs border-border hover:border-primary" onClick={() => addTier()}>
          <Plus className="h-3 w-3 mr-1" /> Add Tier
        </Button>
      </div>

      {tiers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-5 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No ticket tiers added. The default ticket price above will be used.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {PRESET_TIERS.map(name => (
              <Button key={name} type="button" variant="outline" size="sm" className="text-xs border-border hover:border-primary" onClick={() => addTier(name)}>
                + {name}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {tiers.map((tier, idx) => (
            <div key={tier.id} className="rounded-lg border border-border bg-secondary/50 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-muted-foreground font-semibold mt-2">Tier {idx + 1}</span>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeTier(idx)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Tier Name *</Label>
                  <Input value={tier.name} onChange={e => updateTier(idx, { name: e.target.value })} placeholder="e.g. VIP, Early Bird" className="border-border bg-card" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price *</Label>
                  <Input value={tier.price} onChange={e => updateTier(idx, { price: e.target.value })} placeholder="e.g. 1,500 ETB" className="border-border bg-card" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={tier.description} onChange={e => updateTier(idx, { description: e.target.value })} placeholder="What's included in this tier?" className="border-border bg-card" />
              </div>
              {/* Ticket Image Upload */}
              <div className="space-y-1">
                <Label className="text-xs">Ticket Image (PNG/JPG)</Label>
                <p className="text-xs text-muted-foreground">Upload a designed ticket that buyers will receive via email after purchase.</p>
                {tier.ticket_image_url ? (
                  <div className="relative inline-block">
                    <img src={tier.ticket_image_url} alt={`${tier.name} ticket`} className="h-24 rounded-lg border border-border object-contain" />
                    <button
                      type="button"
                      onClick={() => updateTier(idx, { ticket_image_url: "" })}
                      className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-card p-3 hover:border-primary transition-colors">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Click to upload ticket image</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      ref={el => { fileInputRefs.current[idx] = el; }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleTicketImageUpload(idx, file);
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {PRESET_TIERS.filter(p => !tiers.some(t => t.name.toLowerCase() === p.toLowerCase())).map(name => (
              <Button key={name} type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary" onClick={() => addTier(name)}>
                + {name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketTiersEditor;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Star, Quote } from "lucide-react";

interface Testimonial {
  id: string;
  name: string;
  role: string | null;
  organization: string | null;
  quote: string;
  avatar_url: string | null;
  rating: number;
  is_active: boolean;
  created_at: string;
}

const AdminTestimonials = ({ adminId }: { adminId: string }) => {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", role: "", organization: "", quote: "", avatar_url: "", rating: 5 });
  const [adding, setAdding] = useState(false);

  const fetchData = async () => {
    const { data } = await supabase.from("testimonials").select("*").order("created_at", { ascending: false });
    setItems((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.quote.trim()) { toast.error("Name and quote are required"); return; }
    setAdding(true);
    const { error } = await supabase.from("testimonials").insert({
      name: form.name, role: form.role || null, organization: form.organization || null,
      quote: form.quote, avatar_url: form.avatar_url || null, rating: form.rating,
    } as any);
    if (error) toast.error(error.message);
    else { toast.success("Testimonial added!"); setForm({ name: "", role: "", organization: "", quote: "", avatar_url: "", rating: 5 }); fetchData(); }
    setAdding(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("testimonials").update({ is_active: !active } as any).eq("id", id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("testimonials").delete().eq("id", id);
    toast.success("Deleted"); fetchData();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
        <Quote className="h-5 w-5 text-primary" /> Testimonials
      </h2>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Add Testimonial</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input placeholder="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input placeholder="Role / Title" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
          <Input placeholder="Organization" value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} />
          <Input placeholder="Avatar URL" value={form.avatar_url} onChange={e => setForm(f => ({ ...f, avatar_url: e.target.value }))} />
        </div>
        <Textarea placeholder="Quote / Testimonial *" value={form.quote} onChange={e => setForm(f => ({ ...f, quote: e.target.value }))} rows={3} />
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">Rating:</p>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setForm(f => ({ ...f, rating: n }))} className="focus:outline-none">
              <Star className={`h-5 w-5 ${n <= form.rating ? "text-primary fill-primary" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
        <Button onClick={handleAdd} disabled={adding} size="sm"><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map(t => (
          <div key={t.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-start gap-3">
              {t.avatar_url ? (
                <img src={t.avatar_url} alt={t.name} className="h-10 w-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{t.name[0]}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">{t.name}</p>
                {(t.role || t.organization) && <p className="text-xs text-muted-foreground">{[t.role, t.organization].filter(Boolean).join(" · ")}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t.id, t.is_active)} />
                <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDelete(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground italic">"{t.quote}"</p>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`h-3.5 w-3.5 ${i < t.rating ? "text-primary fill-primary" : "text-muted-foreground/30"}`} />
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8 col-span-2">No testimonials yet.</p>}
      </div>
    </div>
  );
};

export default AdminTestimonials;

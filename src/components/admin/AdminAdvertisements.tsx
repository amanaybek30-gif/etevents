import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Megaphone, Upload, X, UserPlus, Video, Timer } from "lucide-react";
import { Label } from "@/components/ui/label";

interface PersonnelItem {
  name: string;
  title: string;
  photo_url: string;
}

interface Ad {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  link_url: string | null;
  event_id: string | null;
  guest_info: any;
  personnel: PersonnelItem[];
  contact_info: { email?: string; phone?: string; website?: string } | null;
  is_active: boolean;
  created_at: string;
}

const AdminAdvertisements = ({ adminId }: { adminId: string }) => {
  const [items, setItems] = useState<Ad[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: "", description: "", event_id: "", link_url: "",
    contact_email: "", contact_phone: "", contact_website: "",
  });
  const [personnel, setPersonnel] = useState<PersonnelItem[]>([]);
  const [adImageFile, setAdImageFile] = useState<File | null>(null);
  const [adImagePreview, setAdImagePreview] = useState<string>("");
  const [adVideoFile, setAdVideoFile] = useState<File | null>(null);
  const [adVideoPreview, setAdVideoPreview] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [carouselDuration, setCarouselDuration] = useState(8);
  const [savingDuration, setSavingDuration] = useState(false);

  const fetchData = async () => {
    const [{ data: ads }, { data: evts }, { data: setting }] = await Promise.all([
      supabase.from("admin_advertisements").select("*").order("created_at", { ascending: false }),
      supabase.from("events").select("id, title, slug").eq("is_published", true),
      supabase.from("platform_settings").select("value").eq("key", "ad_carousel_duration").single(),
    ]);
    setItems((ads as any[]) || []);
    setEvents(evts || []);
    if (setting?.value) setCarouselDuration(parseInt(setting.value) || 8);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("advertisements").upload(path, file);
    if (error) { toast.error("Upload failed: " + error.message); return null; }
    const { data } = supabase.storage.from("advertisements").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleAdImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAdImageFile(file);
    setAdImagePreview(URL.createObjectURL(file));
  };

  const handleAdVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast.error("Video must be under 50MB"); return; }
    setAdVideoFile(file);
    setAdVideoPreview(URL.createObjectURL(file));
  };

  const handlePersonnelPhoto = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, "personnel");
    if (url) {
      setPersonnel(p => p.map((item, i) => i === idx ? { ...item, photo_url: url } : item));
    }
  };

  const addPersonnel = () => setPersonnel(p => [...p, { name: "", title: "", photo_url: "" }]);
  const removePersonnel = (idx: number) => setPersonnel(p => p.filter((_, i) => i !== idx));
  const updatePersonnel = (idx: number, field: keyof PersonnelItem, value: string) =>
    setPersonnel(p => p.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const handleAdd = async () => {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    setAdding(true);

    let imageUrl: string | null = null;
    let videoUrl: string | null = null;
    if (adImageFile) imageUrl = await uploadFile(adImageFile, "banners");
    if (adVideoFile) videoUrl = await uploadFile(adVideoFile, "videos");

    const contactInfo = (form.contact_email || form.contact_phone || form.contact_website)
      ? { email: form.contact_email, phone: form.contact_phone, website: form.contact_website }
      : null;

    const { error } = await supabase.from("admin_advertisements").insert({
      title: form.title,
      description: form.description || null,
      image_url: imageUrl,
      video_url: videoUrl,
      link_url: form.link_url || null,
      event_id: form.event_id || null,
      personnel: personnel.filter(p => p.name.trim()),
      contact_info: contactInfo,
    } as any);

    if (error) toast.error(error.message);
    else {
      toast.success("Ad created!");
      setForm({ title: "", description: "", event_id: "", link_url: "", contact_email: "", contact_phone: "", contact_website: "" });
      setPersonnel([]);
      setAdImageFile(null);
      setAdImagePreview("");
      setAdVideoFile(null);
      setAdVideoPreview("");
      fetchData();
    }
    setAdding(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("admin_advertisements").update({ is_active: !active } as any).eq("id", id);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("admin_advertisements").delete().eq("id", id);
    toast.success("Deleted"); fetchData();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const saveDuration = async (val: number) => {
    setSavingDuration(true);
    const { data: existing } = await supabase.from("platform_settings").select("id").eq("key", "ad_carousel_duration").single();
    if (existing) {
      await supabase.from("platform_settings").update({ value: String(val) } as any).eq("key", "ad_carousel_duration");
    } else {
      await supabase.from("platform_settings").insert({ key: "ad_carousel_duration", value: String(val) } as any);
    }
    setSavingDuration(false);
    toast.success(`Carousel duration set to ${val}s`);
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-primary" /> Advertisements
      </h2>

      {/* Carousel Duration Setting */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <Label className="text-sm font-medium text-foreground">Auto-advance duration</Label>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={carouselDuration}
            onChange={e => {
              const val = parseInt(e.target.value);
              setCarouselDuration(val);
              saveDuration(val);
            }}
          >
            {[3, 5, 8, 10, 15, 20, 30].map(s => (
              <option key={s} value={s}>{s} seconds</option>
            ))}
          </select>
          {savingDuration && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <p className="text-xs text-muted-foreground">Time before auto-scrolling to the next ad on the homepage</p>
      </div>

      {/* Create Form */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">New Advertisement</h3>
        <Input placeholder="Ad Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        <Textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />

        {/* Ad Image Upload */}
        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1 block">Ad Banner Image</label>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition-colors">
              <Upload className="h-4 w-4" /> Choose Image
              <input type="file" accept="image/*" className="hidden" onChange={handleAdImage} />
            </label>
            {adImagePreview && (
              <div className="relative">
                <img src={adImagePreview} alt="" className="h-16 w-28 rounded-lg object-cover" />
                <button onClick={() => { setAdImageFile(null); setAdImagePreview(""); }} className="absolute -top-1 -right-1 bg-destructive rounded-full p-0.5"><X className="h-3 w-3 text-destructive-foreground" /></button>
              </div>
            )}
          </div>
        </div>

        {/* Ad Video Upload */}
        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1 block">Ad Video (optional, max 50MB)</label>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition-colors">
              <Video className="h-4 w-4" /> Choose Video
              <input type="file" accept="video/*" className="hidden" onChange={handleAdVideo} />
            </label>
            {adVideoPreview && (
              <div className="relative">
                <video src={adVideoPreview} className="h-16 w-28 rounded-lg object-cover" muted />
                <button onClick={() => { setAdVideoFile(null); setAdVideoPreview(""); }} className="absolute -top-1 -right-1 bg-destructive rounded-full p-0.5"><X className="h-3 w-3 text-destructive-foreground" /></button>
              </div>
            )}
          </div>
        </div>

        {/* Link to event */}
        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.event_id} onChange={e => setForm(f => ({ ...f, event_id: e.target.value }))}>
          <option value="">Link to event (optional)</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
        </select>

        <Input placeholder="External Link URL (if no event linked)" value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} />

        {/* Contact Info (shown in popup when no event linked) */}
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground font-medium">Contact Info (shown in popup if no event linked)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input placeholder="Contact Email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
            <Input placeholder="Contact Phone" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
            <Input placeholder="Website" value={form.contact_website} onChange={e => setForm(f => ({ ...f, contact_website: e.target.value }))} />
          </div>
        </div>

        {/* Personnel */}
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">Personnel / Guests</p>
            <Button variant="outline" size="sm" onClick={addPersonnel}><UserPlus className="h-3.5 w-3.5 mr-1" /> Add Person</Button>
          </div>
          {personnel.map((p, idx) => (
            <div key={idx} className="flex items-start gap-2 bg-secondary/30 rounded-lg p-2">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input placeholder="Name" value={p.name} onChange={e => updatePersonnel(idx, "name", e.target.value)} />
                <Input placeholder="Title / Role" value={p.title} onChange={e => updatePersonnel(idx, "title", e.target.value)} />
                <div className="sm:col-span-2 flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-xs hover:bg-accent transition-colors">
                    <Upload className="h-3 w-3" /> Photo
                    <input type="file" accept="image/*" className="hidden" onChange={e => handlePersonnelPhoto(idx, e)} />
                  </label>
                  {p.photo_url && <img src={p.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => removePersonnel(idx)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>

        <Button onClick={handleAdd} disabled={adding} size="sm"><Plus className="h-4 w-4 mr-1" /> Create Ad</Button>
      </div>

      {/* Existing Ads */}
      <div className="space-y-3">
        {items.map(a => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row items-start gap-4">
            {a.video_url ? (
              <video src={a.video_url} className="h-20 w-28 rounded-lg object-cover shrink-0" muted controls />
            ) : a.image_url ? (
              <img src={a.image_url} alt="" className="h-20 w-20 rounded-lg object-cover shrink-0" />
            ) : null}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground">{a.title}</p>
                <span className="text-[10px] uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">Sponsored</span>
              </div>
              {a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
              {(a.personnel as any[])?.length > 0 && (
                <div className="flex gap-2 mt-1">
                  {(a.personnel as any[]).map((p: any, i: number) => (
                    <span key={i} className="text-xs text-muted-foreground">{p.name}{p.title ? ` — ${p.title}` : ""}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={a.is_active} onCheckedChange={() => toggleActive(a.id, a.is_active)} />
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No advertisements yet.</p>}
      </div>
    </div>
  );
};

export default AdminAdvertisements;

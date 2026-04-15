import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Megaphone, Loader2 } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  message: string | null;
  image_url: string | null;
  link_url: string | null;
  link_text: string | null;
  is_active: boolean;
  priority: number;
  created_at: string;
}

const AdminAnnouncements = ({ adminId }: { adminId: string }) => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", message: "", image_url: "", link_url: "", link_text: "", priority: 0 });
  const [adding, setAdding] = useState(false);

  const fetch = async () => {
    const { data } = await supabase.from("admin_announcements").select("*").order("priority", { ascending: false }).order("created_at", { ascending: false });
    setItems((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const handleAdd = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setAdding(true);
    const { error } = await supabase.from("admin_announcements").insert({
      title: form.title, message: form.message || null, image_url: form.image_url || null,
      link_url: form.link_url || null, link_text: form.link_text || null, priority: form.priority,
    } as any);
    if (error) toast.error(error.message);
    else { toast.success("Announcement published!"); setForm({ title: "", message: "", image_url: "", link_url: "", link_text: "", priority: 0 }); fetch(); }
    setAdding(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("admin_announcements").update({ is_active: !active } as any).eq("id", id);
    fetch();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("admin_announcements").delete().eq("id", id);
    toast.success("Deleted"); fetch();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-primary" /> Announcements
      </h2>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">New Announcement</h3>
        <Input placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        <Textarea placeholder="Message (optional)" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input placeholder="Image URL (optional)" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
          <Input placeholder="Link URL (optional)" value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} />
          <Input placeholder="Link Text (optional)" value={form.link_text} onChange={e => setForm(f => ({ ...f, link_text: e.target.value }))} />
        </div>
        <Button onClick={handleAdd} disabled={adding} size="sm"><Plus className="h-4 w-4 mr-1" /> Publish</Button>
      </div>

      <div className="space-y-3">
        {items.map(a => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-4 flex items-start gap-4">
            {a.image_url && <img src={a.image_url} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">{a.title}</p>
              {a.message && <p className="text-sm text-muted-foreground line-clamp-2">{a.message}</p>}
              {a.link_url && <a href={a.link_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">{a.link_text || a.link_url}</a>}
              <p className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={a.is_active} onCheckedChange={() => toggleActive(a.id, a.is_active)} />
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(a.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No announcements yet.</p>}
      </div>
    </div>
  );
};

export default AdminAnnouncements;

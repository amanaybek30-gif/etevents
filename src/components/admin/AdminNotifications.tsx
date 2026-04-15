import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bell, Send, Trash2 } from "lucide-react";

interface Notification {
  id: string; title: string; message: string; type: string;
  target: string; is_read: boolean; created_at: string;
}

interface Props { adminId: string; }

const AdminNotifications = ({ adminId }: Props) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [form, setForm] = useState({ title: "", message: "", type: "info", target: "all" });

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    const { data } = await supabase.from("admin_notifications").select("*").order("created_at", { ascending: false });
    if (data) setNotifications(data);
  };

  const sendNotification = async () => {
    if (!form.title || !form.message) { toast.error("Title and message required"); return; }
    const { error } = await supabase.from("admin_notifications").insert(form);
    if (error) { toast.error(error.message); return; }
    await supabase.from("admin_logs").insert({ admin_id: adminId, action: "sent notification", details: `${form.target}: ${form.title}` });
    toast.success("Notification sent");
    setForm({ title: "", message: "", type: "info", target: "all" });
    fetchNotifications();
  };

  const deleteNotif = async (id: string) => {
    await supabase.from("admin_notifications").delete().eq("id", id);
    toast.success("Deleted");
    fetchNotifications();
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <Bell className="h-6 w-6 text-primary" /> Notifications
      </h1>

      {/* Send Form */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Send Notification</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label className="text-xs">Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="border-border bg-secondary" /></div>
          <div className="flex gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Target</Label>
              <Select value={form.target} onValueChange={v => setForm({ ...form, target: v })}>
                <SelectTrigger className="border-border bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="organizers">Organizers</SelectItem>
                  <SelectItem value="attendees">Attendees</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="border-border bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="alert">Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="space-y-1"><Label className="text-xs">Message *</Label><Textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="border-border bg-secondary" rows={3} /></div>
        <Button size="sm" onClick={sendNotification}><Send className="mr-1 h-3 w-3" /> Send</Button>
      </div>

      {/* History */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">History</h3>
        {notifications.map(n => (
          <div key={n.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${n.type === "alert" ? "bg-destructive" : n.type === "warning" ? "bg-yellow-500" : "bg-primary"}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{n.title}</p>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{n.target}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => deleteNotif(n.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {notifications.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No notifications sent yet.</p>}
      </div>
    </div>
  );
};

export default AdminNotifications;

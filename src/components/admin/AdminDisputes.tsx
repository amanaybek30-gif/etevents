import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Plus, X, CheckCircle, Pause, FileText } from "lucide-react";

interface Dispute {
  id: string; user_name: string; user_email: string; event_title: string;
  issue: string; description: string | null; status: string;
  admin_notes: string | null; created_at: string;
}

interface Props { searchQuery: string; adminId: string; }

const AdminDisputes = ({ searchQuery, adminId }: Props) => {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [noteText, setNoteText] = useState("");
  const [form, setForm] = useState({ user_name: "", user_email: "", event_title: "", issue: "", description: "" });

  useEffect(() => { fetchDisputes(); }, [statusFilter]);

  const fetchDisputes = async () => {
    let query = supabase.from("disputes").select("*").order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data } = await query;
    if (data) setDisputes(data);
  };

  const createDispute = async () => {
    if (!form.user_name || !form.issue) { toast.error("Name and issue required"); return; }
    const { error } = await supabase.from("disputes").insert({
      user_name: form.user_name, user_email: form.user_email,
      event_title: form.event_title, issue: form.issue,
      description: form.description || null,
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("admin_logs").insert({ admin_id: adminId, action: "created dispute", target_type: "dispute", details: form.issue });
    toast.success("Dispute created");
    setShowCreate(false);
    setForm({ user_name: "", user_email: "", event_title: "", issue: "", description: "" });
    fetchDisputes();
  };

  const updateDisputeStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("disputes").update({ status }).eq("id", id);
    if (error) { toast.error("Failed"); return; }
    await supabase.from("admin_logs").insert({ admin_id: adminId, action: `${status} dispute`, target_type: "dispute", target_id: id });
    toast.success(`Dispute ${status}`);
    fetchDisputes();
    if (selectedDispute?.id === id) setSelectedDispute(prev => prev ? { ...prev, status } : null);
  };

  const addNote = async (id: string) => {
    if (!noteText.trim()) return;
    const existing = selectedDispute?.admin_notes || "";
    const newNotes = existing ? `${existing}\n[${new Date().toLocaleString()}] ${noteText}` : `[${new Date().toLocaleString()}] ${noteText}`;
    const { error } = await supabase.from("disputes").update({ admin_notes: newNotes }).eq("id", id);
    if (error) { toast.error("Failed"); return; }
    toast.success("Note added");
    setNoteText("");
    fetchDisputes();
    setSelectedDispute(prev => prev ? { ...prev, admin_notes: newNotes } : null);
  };

  const q = searchQuery.toLowerCase();
  const filtered = disputes.filter(d => !q || d.user_name.toLowerCase().includes(q) || d.issue.toLowerCase().includes(q));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-yellow-500" /> Disputes
        </h1>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1 h-3 w-3" /> New</Button>
      </div>

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-40 border-border bg-secondary"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="investigating">Investigating</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
        </SelectContent>
      </Select>

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-foreground">New Dispute</h3><button onClick={() => setShowCreate(false)}><X className="h-4 w-4 text-muted-foreground" /></button></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label className="text-xs">User Name *</Label><Input value={form.user_name} onChange={e => setForm({ ...form, user_name: e.target.value })} className="border-border bg-secondary" /></div>
            <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={form.user_email} onChange={e => setForm({ ...form, user_email: e.target.value })} className="border-border bg-secondary" /></div>
            <div className="space-y-1"><Label className="text-xs">Event</Label><Input value={form.event_title} onChange={e => setForm({ ...form, event_title: e.target.value })} className="border-border bg-secondary" /></div>
            <div className="space-y-1"><Label className="text-xs">Issue *</Label><Input value={form.issue} onChange={e => setForm({ ...form, issue: e.target.value })} className="border-border bg-secondary" /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="border-border bg-secondary" /></div>
          <Button size="sm" onClick={createDispute}>Create Dispute</Button>
        </div>
      )}

      {/* Detail */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setSelectedDispute(null)}>
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4 max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedDispute(null)} className="absolute right-3 top-3 text-muted-foreground"><X className="h-5 w-5" /></button>
            <h2 className="font-display text-lg font-bold text-foreground">Dispute Detail</h2>
            <div className="text-sm space-y-2">
              <div><span className="text-muted-foreground">User:</span> <span className="text-foreground">{selectedDispute.user_name}</span></div>
              <div><span className="text-muted-foreground">Event:</span> <span className="text-foreground">{selectedDispute.event_title}</span></div>
              <div><span className="text-muted-foreground">Issue:</span> <span className="text-foreground">{selectedDispute.issue}</span></div>
              {selectedDispute.description && <div><span className="text-muted-foreground">Details:</span> <p className="text-foreground mt-1">{selectedDispute.description}</p></div>}
              <div><span className="text-muted-foreground">Status:</span> <span className={`font-semibold ${selectedDispute.status === "resolved" ? "text-green-500" : selectedDispute.status === "investigating" ? "text-yellow-500" : "text-destructive"}`}>{selectedDispute.status}</span></div>
            </div>
            {selectedDispute.admin_notes && (
              <div className="rounded-lg bg-secondary p-3 text-xs text-foreground whitespace-pre-wrap">{selectedDispute.admin_notes}</div>
            )}
            <div className="flex gap-2">
              <Input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add note..." className="border-border bg-secondary text-sm" />
              <Button size="sm" onClick={() => addNote(selectedDispute.id)}><FileText className="h-3 w-3" /></Button>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => updateDisputeStatus(selectedDispute.id, "investigating")} className="flex-1 text-xs"><Pause className="mr-1 h-3 w-3" /> Investigate</Button>
              <Button size="sm" variant="outline" onClick={() => updateDisputeStatus(selectedDispute.id, "resolved")} className="flex-1 text-xs"><CheckCircle className="mr-1 h-3 w-3" /> Resolve</Button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary">
            <tr>{["User", "Event", "Issue", "Status", "Date", "Actions"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} className="border-b border-border hover:bg-secondary/50 cursor-pointer" onClick={() => setSelectedDispute(d)}>
                <td className="px-4 py-3 text-foreground text-xs">{d.user_name}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{d.event_title}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs max-w-32 truncate">{d.issue}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${d.status === "resolved" ? "bg-green-500/10 text-green-500" : d.status === "investigating" ? "bg-yellow-500/10 text-yellow-500" : "bg-destructive/10 text-destructive"}`}>{d.status}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3" onClick={ev => ev.stopPropagation()}>
                  <Button size="sm" variant="ghost" onClick={() => updateDisputeStatus(d.id, "resolved")} className="h-7 text-xs text-green-500"><CheckCircle className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No disputes found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDisputes;

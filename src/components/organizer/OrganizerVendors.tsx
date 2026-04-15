import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Store, Search, CheckCircle, XCircle, Clock, Mail, Eye, X } from "lucide-react";

interface Props { userId: string; }

interface VendorApp {
  id: string;
  event_id: string;
  vendor_name: string;
  brand_name: string | null;
  contact_person: string;
  phone: string;
  email: string;
  vendor_type: string;
  description: string | null;
  website: string | null;
  booth_size: string | null;
  power_required: boolean;
  special_requirements: string | null;
  status: string;
  organizer_notes: string | null;
  created_at: string;
  event_title?: string;
  selected_package: string | null;
  selected_package_price: string | null;
}

const OrganizerVendors = ({ userId }: Props) => {
  const [vendors, setVendors] = useState<VendorApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<VendorApp | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => { fetchVendors(); }, [userId]);

  const fetchVendors = async () => {
    const { data: events } = await supabase.from("events").select("id, title").eq("organizer_id", userId);
    if (!events || events.length === 0) { setLoading(false); return; }

    const ids = events.map(e => e.id);
    const evMap = Object.fromEntries(events.map(e => [e.id, e.title]));

    const { data } = await supabase
      .from("vendor_registrations")
      .select("*")
      .in("event_id", ids)
      .order("created_at", { ascending: false });

    if (data) {
      setVendors((data as any[]).map(v => ({ ...v, event_title: evMap[v.event_id] || "Unknown" })));
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("vendor_registrations").update({ status, organizer_notes: notes, updated_at: new Date().toISOString() } as any).eq("id", id);
    toast.success(`Vendor ${status}`);
    setSelected(null);
    setNotes("");
    fetchVendors();
  };

  const filtered = vendors.filter(v => {
    if (search) {
      const q = search.toLowerCase();
      if (!v.vendor_name.toLowerCase().includes(q) && !v.email.toLowerCase().includes(q) && !v.contact_person.toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== "all" && v.status !== statusFilter) return false;
    return true;
  });

  const statusBadge = (s: string) => {
    const map: Record<string, { bg: string; text: string; icon: any }> = {
      pending: { bg: "bg-amber-500/10", text: "text-amber-400", icon: Clock },
      approved: { bg: "bg-green-500/10", text: "text-green-400", icon: CheckCircle },
      rejected: { bg: "bg-destructive/10", text: "text-destructive", icon: XCircle },
    };
    const cfg = map[s] || map.pending;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
        <cfg.icon className="h-3 w-3" /> {s.charAt(0).toUpperCase() + s.slice(1)}
      </span>
    );
  };

  if (loading) return <div className="flex justify-center py-20 text-muted-foreground">Loading vendor applications...</div>;

  return (
    <div className="space-y-6">
      <h3 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
        <Store className="h-5 w-5 text-primary" /> Vendor Applications
      </h3>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", count: vendors.length, color: "text-primary" },
          { label: "Pending", count: vendors.filter(v => v.status === "pending").length, color: "text-amber-400" },
          { label: "Approved", count: vendors.filter(v => v.status === "approved").length, color: "text-green-400" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <p className={`font-display text-xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors..." className="pl-9 border-border bg-secondary" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px] border-border bg-secondary"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary">
            <tr>{["#", "Vendor", "Event", "Type", "Package", "Contact", "Status", ""].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {filtered.map((v, idx) => (
              <tr key={v.id} className="border-b border-border hover:bg-secondary/50">
                <td className="px-4 py-3 text-xs font-bold text-muted-foreground">{idx + 1}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{v.vendor_name}</p>
                  {v.brand_name && <p className="text-xs text-muted-foreground">{v.brand_name}</p>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{v.event_title}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{v.vendor_type}</td>
                <td className="px-4 py-3">
                  {v.selected_package ? (
                    <div>
                      <p className="text-xs font-medium text-foreground">{v.selected_package}</p>
                      {v.selected_package_price && <p className="text-[10px] text-primary font-semibold">{v.selected_package_price} ETB</p>}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{v.contact_person}</td>
                <td className="px-4 py-3">{statusBadge(v.status)}</td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => { setSelected(v); setNotes(v.organizer_notes || ""); }}>
                    <Eye className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No vendor applications yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-foreground">{selected.vendor_name}</h3>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-2 text-sm">
              {[
                ["Brand", selected.brand_name],
                ["Contact", selected.contact_person],
                ["Email", selected.email],
                ["Phone", selected.phone],
                ["Type", selected.vendor_type],
                ["Description", selected.description],
                ["Website", selected.website],
                ["Booth Size", selected.booth_size],
                ["Power Required", selected.power_required ? "Yes" : "No"],
                ["Special Reqs", selected.special_requirements],
                ["Selected Package", selected.selected_package],
                ["Package Price", selected.selected_package_price ? `${selected.selected_package_price} ETB` : null],
                ["Event", selected.event_title],
                ["Applied", new Date(selected.created_at).toLocaleDateString()],
              ].filter(([, v]) => v).map(([label, value]) => (
                <p key={label as string} className="text-muted-foreground">{label}: <span className="text-foreground">{value}</span></p>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Organizer Notes</p>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes..." className="border-border bg-secondary min-h-[60px]" />
            </div>

            <div className="flex gap-2">
              <Button onClick={() => updateStatus(selected.id, "approved")} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle className="mr-2 h-4 w-4" /> Approve
              </Button>
              <Button onClick={() => updateStatus(selected.id, "rejected")} variant="destructive" className="flex-1">
                <XCircle className="mr-2 h-4 w-4" /> Reject
              </Button>
              <Button variant="outline" onClick={() => window.open(`mailto:${selected.email}`)} className="shrink-0 border-border">
                <Mail className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizerVendors;

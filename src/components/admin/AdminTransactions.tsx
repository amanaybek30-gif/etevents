import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, CheckCircle, XCircle, AlertTriangle, X } from "lucide-react";

interface Registration {
  id: string; ticket_id: string; full_name: string; email: string; phone: string;
  payment_method: string; bank_name: string | null; receipt_url: string | null;
  status: string; created_at: string; event_id: string; event_slug: string;
}

interface EventMap { [id: string]: string; }

interface Props { searchQuery: string; adminId: string; }

const AdminTransactions = ({ searchQuery, adminId }: Props) => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [eventMap, setEventMap] = useState<EventMap>({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [receiptModal, setReceiptModal] = useState<{ url: string; isPdf: boolean } | null>(null);
  const [selectedTx, setSelectedTx] = useState<Registration | null>(null);

  useEffect(() => { fetchData(); }, [statusFilter, methodFilter]);

  const fetchData = async () => {
    const { data: events } = await supabase.from("events").select("id, title");
    const map: EventMap = {};
    events?.forEach(e => { map[e.id] = e.title; });
    setEventMap(map);

    let query = supabase.from("registrations").select("*").order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (methodFilter !== "all") query = query.eq("payment_method", methodFilter);
    const { data } = await query;
    if (data) setRegistrations(data as Registration[]);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("registrations").update({ status }).eq("id", id);
    if (error) { toast.error("Failed"); return; }
    // Log action
    await supabase.from("admin_logs").insert({ admin_id: adminId, action: `${status} payment`, target_type: "registration", target_id: id });
    toast.success(`Transaction ${status}`);
    fetchData();
    if (selectedTx?.id === id) setSelectedTx(null);
  };

  const viewReceipt = async (path: string) => {
    const isPdf = path.toLowerCase().endsWith(".pdf");
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 3600);
    if (data?.signedUrl) setReceiptModal({ url: data.signedUrl, isPdf });
  };

  const q = searchQuery.toLowerCase();
  const filtered = registrations.filter(r => !q || r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.ticket_id.toLowerCase().includes(q));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Transactions</h1>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36 border-border bg-secondary"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-full sm:w-40 border-border bg-secondary"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            <SelectItem value="telebirr">Telebirr</SelectItem>
            <SelectItem value="mpessa">M-Pesa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setSelectedTx(null)}>
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedTx(null)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            <h2 className="font-display text-lg font-bold text-foreground">Transaction Detail</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Name:</span><span className="text-foreground">{selectedTx.full_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Email:</span><span className="text-foreground">{selectedTx.email}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Phone:</span><span className="text-foreground">{selectedTx.phone}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Event:</span><span className="text-foreground">{eventMap[selectedTx.event_id] || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Method:</span><span className="text-foreground">{selectedTx.payment_method}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Bank:</span><span className="text-foreground">{selectedTx.bank_name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status:</span>
                <span className={`font-semibold ${selectedTx.status === "approved" ? "text-green-500" : selectedTx.status === "rejected" ? "text-destructive" : "text-yellow-500"}`}>{selectedTx.status}</span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Date:</span><span className="text-foreground">{new Date(selectedTx.created_at).toLocaleString()}</span></div>
            </div>
            {selectedTx.receipt_url && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => viewReceipt(selectedTx.receipt_url!)}>
                <Eye className="mr-1 h-3 w-3" /> View Receipt
              </Button>
            )}
            <div className="flex gap-2 pt-2">
              <Button size="sm" className="flex-1 bg-green-500/10 text-green-500 hover:bg-green-500/20 border-0" onClick={() => updateStatus(selectedTx.id, "approved")}>
                <CheckCircle className="mr-1 h-3 w-3" /> Approve
              </Button>
              <Button size="sm" className="flex-1 bg-destructive/10 text-destructive hover:bg-destructive/20 border-0" onClick={() => updateStatus(selectedTx.id, "rejected")}>
                <XCircle className="mr-1 h-3 w-3" /> Reject
              </Button>
              <Button size="sm" className="flex-1 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-0" onClick={() => toast.info("Flagged as suspicious")}>
                <AlertTriangle className="mr-1 h-3 w-3" /> Flag
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary">
            <tr>{["User", "Event", "Method", "Status", "Date", "Actions"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-b border-border hover:bg-secondary/50 cursor-pointer transition-colors" onClick={() => setSelectedTx(r)}>
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground text-xs">{r.full_name}</p>
                  <p className="text-xs text-muted-foreground">{r.email}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{eventMap[r.event_id] || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{r.payment_method}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === "approved" ? "bg-green-500/10 text-green-500" : r.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-yellow-500/10 text-yellow-500"}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3" onClick={ev => ev.stopPropagation()}>
                  <div className="flex gap-1">
                    {r.status === "pending" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "approved")} className="h-7 w-7 p-0 text-green-500"><CheckCircle className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "rejected")} className="h-7 w-7 p-0 text-destructive"><XCircle className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                    {r.receipt_url && <Button size="sm" variant="ghost" onClick={() => viewReceipt(r.receipt_url!)} className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"><Eye className="h-3.5 w-3.5" /></Button>}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No transactions found.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Receipt Modal */}
      {receiptModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setReceiptModal(null)}>
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl border border-border bg-card p-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => setReceiptModal(null)} className="absolute right-3 top-3 z-10 rounded-full bg-card p-1 border border-border text-foreground hover:text-primary"><X className="h-5 w-5" /></button>
            {receiptModal.isPdf ? (
              <iframe src={receiptModal.url} title="Receipt" className="h-[70vh] w-full rounded-lg" />
            ) : (
              <img src={receiptModal.url} alt="Payment Receipt" className="w-full rounded-lg" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTransactions;

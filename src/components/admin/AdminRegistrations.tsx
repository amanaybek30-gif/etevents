import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import * as XLSX from "xlsx";
import { CheckCircle, XCircle, Eye, QrCode, Camera, ScanLine, Download, Loader2 } from "lucide-react";

interface Registration {
  id: string; ticket_id: string; full_name: string; email: string; phone: string;
  payment_method: string; status: string; checked_in: boolean | null;
  checked_in_at: string | null; created_at: string; event_id: string;
  receipt_url: string | null; source: string;
}
interface EventRow { id: string; title: string; }

interface Props { searchQuery: string; adminId: string; }

const REJECTION_REASONS = [
  "Receipt is not correct",
  "Registration is full",
  "Twice registered",
  "Other",
];

const AdminRegistrations = ({ searchQuery, adminId }: Props) => {
  const [regs, setRegs] = useState<Registration[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [scannerActive, setScannerActive] = useState(false);
  const [manualTicket, setManualTicket] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Rejection dialog state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionDetails, setRejectionDetails] = useState("");
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => { fetchEvents(); }, []);
  useEffect(() => { fetchRegs(); }, [selectedEvent, statusFilter]);

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("id, title").order("date");
    if (data) setEvents(data);
  };

  const fetchRegs = async () => {
    let query = supabase.from("registrations").select("*").order("created_at", { ascending: false });
    if (selectedEvent !== "all") query = query.eq("event_id", selectedEvent);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data } = await query;
    if (data) setRegs(data as Registration[]);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("registrations").update({ status }).eq("id", id);
    if (error) { toast.error("Failed"); return; }
    await supabase.from("admin_logs").insert({ admin_id: adminId, action: `${status} registration`, target_type: "registration", target_id: id });
    toast.success(`Registration ${status}`);
    fetchRegs();
  };

  const openRejectDialog = (id: string) => {
    setRejectingId(id);
    setRejectionReason("");
    setRejectionDetails("");
  };

  const confirmReject = async () => {
    if (!rejectingId || !rejectionReason) { toast.error("Please select a reason"); return; }
    setRejecting(true);

    const finalReason = rejectionReason === "Other" ? (rejectionDetails || "Other") : rejectionReason;

    const { error } = await supabase.from("registrations").update({ status: "rejected" }).eq("id", rejectingId);
    if (error) { toast.error("Failed to reject"); setRejecting(false); return; }

    await supabase.from("admin_logs").insert({ admin_id: adminId, action: "rejected registration", target_type: "registration", target_id: rejectingId, details: `Reason: ${finalReason}` });

    const reg = regs.find(r => r.id === rejectingId);
    if (reg) {
      try {
        const event = events.find(e => e.id === reg.event_id);
        await supabase.functions.invoke("send-rejection-email", {
          body: {
            fullName: reg.full_name,
            email: reg.email,
            eventTitle: event?.title || "",
            rejectionReason: finalReason,
            rejectionDetails: rejectionReason === "Other" ? rejectionDetails : "",
          },
        });
        toast.success("Rejection email sent to attendee");
      } catch { toast.warning("Rejected but email failed to send"); }
    }

    toast.success("Registration rejected");
    setRejectingId(null);
    setRejecting(false);
    fetchRegs();
  };

  const checkIn = async (ticketId: string) => {
    const { data: reg } = await supabase.from("registrations").select("*").eq("ticket_id", ticketId).maybeSingle();
    if (!reg) { toast.error("Ticket not found"); return; }
    if (reg.status !== "approved") { toast.error("Not approved"); return; }
    if (reg.checked_in) { toast.error("Already checked in"); return; }
    await supabase.from("registrations").update({ checked_in: true, checked_in_at: new Date().toISOString() }).eq("ticket_id", ticketId);
    toast.success(`${reg.full_name} checked in!`);
    fetchRegs();
  };

  const startScanner = async () => {
    setScannerActive(true);
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("admin-qr-reader");
        scannerRef.current = scanner;
        await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
          (text) => { scanner.stop(); setScannerActive(false); checkIn(text); }, () => {});
      } catch { toast.error("Camera denied"); setScannerActive(false); }
    }, 100);
  };

  const stopScanner = () => { scannerRef.current?.stop().catch(() => {}); setScannerActive(false); };

  const exportToExcel = () => {
    const eventName = selectedEvent !== "all" 
      ? events.find(e => e.id === selectedEvent)?.title || "All-Events"
      : "All-Events";
    const dateStr = new Date().toISOString().split("T")[0];
    const fileName = `${eventName.replace(/[^a-zA-Z0-9]/g, "-")}_${dateStr}.xlsx`;

    const data = filtered.map(r => ({
      "Ticket ID": r.ticket_id, Name: r.full_name, Email: r.email, Phone: r.phone,
      Payment: r.payment_method, Status: r.status, Source: r.source === "imported" ? "Imported" : "Platform",
      "Checked In": r.checked_in ? "Yes" : "No",
      "Check-in Time": r.checked_in_at ? new Date(r.checked_in_at).toLocaleString() : "—",
      "Registration Date": new Date(r.created_at).toLocaleString(),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registrations");
    XLSX.writeFile(wb, fileName);
  };

  const q = searchQuery.toLowerCase();
  const filtered = regs.filter(r => {
    if (q && !r.full_name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q) && !r.ticket_id.toLowerCase().includes(q)) return false;
    if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Registrations</h1>
        <Button variant="outline" size="sm" onClick={exportToExcel}><Download className="mr-1 h-3 w-3" /> Export</Button>
      </div>

      {/* Check-in */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><ScanLine className="h-4 w-4 text-primary" /> QR Check-in</h3>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex gap-2 flex-1">
            <Input placeholder="Ticket ID..." value={manualTicket} onChange={e => setManualTicket(e.target.value)} className="border-border bg-secondary" />
            <Button onClick={() => { checkIn(manualTicket); setManualTicket(""); }} className="bg-gradient-gold text-primary-foreground hover:opacity-90 shrink-0">Check In</Button>
          </div>
          <Button variant="outline" onClick={scannerActive ? stopScanner : startScanner}><Camera className="mr-1 h-4 w-4" /> {scannerActive ? "Stop" : "Scan"}</Button>
        </div>
        {scannerActive && <div className="mx-auto max-w-sm overflow-hidden rounded-lg border border-primary/30"><div id="admin-qr-reader" /></div>}
      </div>

      {/* Source Tabs */}
      <div className="flex gap-1 rounded-lg bg-secondary p-1">
        {[{ value: "all", label: "All" }, { value: "platform", label: "Platform" }, { value: "imported", label: "Imported" }].map(tab => (
          <button
            key={tab.value}
            onClick={() => setSourceFilter(tab.value)}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${sourceFilter === tab.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] opacity-70">
              {tab.value === "all" ? regs.length : regs.filter(r => r.source === tab.value).length}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={selectedEvent} onValueChange={setSelectedEvent}>
          <SelectTrigger className="w-full sm:w-52 border-border bg-secondary"><SelectValue placeholder="All Events" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36 border-border bg-secondary"><SelectValue /></SelectTrigger>
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
            <tr>{["Name", "Event", "Source", "Payment", "Ticket Status", "Check-in Time", "Registered", "Actions"].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-b border-border hover:bg-secondary/50">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground text-xs">{r.full_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{r.ticket_id}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{events.find(e => e.id === r.event_id)?.title || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.source === "imported" ? "bg-blue-500/10 text-blue-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                    {r.source === "imported" ? "Imported" : "Platform"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === "approved" ? "bg-green-500/10 text-green-500" : r.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-yellow-500/10 text-yellow-500"}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3">{r.checked_in ? <span className="text-xs text-green-500">✓ Checked in</span> : <span className="text-xs text-muted-foreground">Not checked in</span>}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{r.checked_in_at ? new Date(r.checked_in_at).toLocaleString() : "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {r.status === "pending" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "approved")} className="h-7 w-7 p-0 text-green-500"><CheckCircle className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => openRejectDialog(r.id)} className="h-7 w-7 p-0 text-destructive"><XCircle className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                    {r.status === "approved" && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary group relative">
                        <QrCode className="h-3.5 w-3.5" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden rounded-lg border border-border bg-white p-3 shadow-lg group-hover:block z-10">
                          <QRCodeSVG value={r.ticket_id} size={100} bgColor="#ffffff" fgColor="#000000" level="H" includeMargin />
                        </div>
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No registrations found.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Rejection Reason Dialog */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => !rejecting && setRejectingId(null)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-foreground">Reject Registration</h3>
            <p className="text-sm text-muted-foreground">
              Please select the reason for rejecting this registration. The attendee will be notified via email.
            </p>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={rejectionReason} onValueChange={setRejectionReason}>
                <SelectTrigger className="border-border bg-secondary"><SelectValue placeholder="Select a reason" /></SelectTrigger>
                <SelectContent>
                  {REJECTION_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {rejectionReason === "Other" && (
              <div className="space-y-2">
                <Label>Please specify *</Label>
                <Textarea value={rejectionDetails} onChange={e => setRejectionDetails(e.target.value)}
                  placeholder="Describe the reason for rejection..." className="border-border bg-secondary min-h-[80px]" />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setRejectingId(null)} disabled={rejecting} className="flex-1 border-border">Cancel</Button>
              <Button onClick={confirmReject} disabled={rejecting || !rejectionReason || (rejectionReason === "Other" && !rejectionDetails.trim())}
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {rejecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                Reject & Notify
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRegistrations;

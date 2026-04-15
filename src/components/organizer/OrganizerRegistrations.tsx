import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import * as XLSX from "xlsx";
import { Search, Download, CheckCircle, XCircle, QrCode, Eye, Upload, Trash2, Loader2, Link, Copy } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Registration {
  id: string; ticket_id: string; full_name: string; email: string; phone: string;
  payment_method: string; bank_name: string | null; receipt_url: string | null;
  status: string; checked_in: boolean | null; checked_in_at: string | null;
  created_at: string; event_slug: string; event_id: string; source: string;
  email_sent: boolean | null; attendee_type: string; attendance_confirmed: string | null;
  custom_answers: Record<string, unknown> | null;
}

interface EventRow { id: string; title: string; slug: string; }

interface Props {
  userId: string;
  searchQuery: string;
  userPlan?: string;
  subscriptionEnabled?: boolean;
  isPaid?: boolean;
  onRequirePlan?: () => void;
}

const REJECTION_REASONS = [
  "Receipt is not correct",
  "Registration is full",
  "Twice registered",
  "Other",
];

const ATTENDEE_TYPE_LABELS: Record<string, string> = {
  participant: "Participant",
  vendor: "Vendor",
  speaker: "Speaker",
  vip: "VIP",
  media: "Media",
  other: "Other",
};

const ATTENDEE_TYPE_COLORS: Record<string, string> = {
  participant: "bg-blue-500/10 text-blue-400",
  vendor: "bg-amber-500/10 text-amber-400",
  speaker: "bg-purple-500/10 text-purple-400",
  vip: "bg-primary/10 text-primary",
  media: "bg-cyan-500/10 text-cyan-400",
  other: "bg-muted text-muted-foreground",
};

const RSVP_BASE_URL = "https://vers.vionevents.com/confirm-attendance";

const buildEventRSVPLink = (eventSlug: string) =>
  `${RSVP_BASE_URL}?event=${encodeURIComponent(eventSlug)}`;

const OrganizerRegistrations = ({ userId, searchQuery, userPlan = "free", subscriptionEnabled = false, isPaid = true, onRequirePlan }: Props) => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [receiptModal, setReceiptModal] = useState<{ url: string; isPdf: boolean } | null>(null);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [checkinFilter, setCheckinFilter] = useState("all");
  const [confirmFilter, setConfirmFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionDetails, setRejectionDetails] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [expandedResponses, setExpandedResponses] = useState<string | null>(null);
  const [eventQuestions, setEventQuestions] = useState<Record<string, { id: string; label: string }[]>>({});

  // Load custom questions for events to map question IDs to labels
  useEffect(() => {
    const loadQuestions = async () => {
      if (events.length === 0) return;
      const { data } = await supabase.from("events").select("id, custom_questions").in("id", events.map(e => e.id));
      if (data) {
        const qMap: Record<string, { id: string; label: string }[]> = {};
        data.forEach(ev => {
          if (ev.custom_questions && Array.isArray(ev.custom_questions)) {
            qMap[ev.id] = (ev.custom_questions as any[]).map(q => ({ id: q.id, label: q.label }));
          }
        });
        setEventQuestions(qMap);
      }
    };
    loadQuestions();
  }, [events]);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase.from("events").select("id, title, slug").eq("organizer_id", userId);
      if (data) setEvents(data);
    };
    fetchEvents();
  }, [userId]);

  useEffect(() => {
    fetchRegistrations();
  }, [userId, events, selectedEvent, statusFilter]);

  // Realtime subscription for live updates
  useEffect(() => {
    if (events.length === 0) return;
    const ids = events.map(e => e.id);
    const channel = supabase
      .channel('registrations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, (payload) => {
        const row = payload.new as any;
        if (row && ids.includes(row.event_id)) {
          fetchRegistrations();
        } else if (payload.eventType === 'DELETE') {
          fetchRegistrations();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [events, selectedEvent, statusFilter]);

  const fetchRegistrations = async () => {
    if (events.length === 0) { setRegistrations([]); setLoading(false); return; }
    let query = supabase.from("registrations").select("*").order("created_at", { ascending: false });
    if (selectedEvent !== "all") {
      query = query.eq("event_id", selectedEvent);
    } else {
      query = query.in("event_id", events.map(e => e.id));
    }
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data } = await query;
    if (data) setRegistrations(data as Registration[]);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    if (!isPaid) { onRequirePlan?.(); return; }
    const { error } = await supabase.from("registrations").update({ status }).eq("id", id);
    if (error) { toast.error("Failed to update"); return; }
    toast.success(`Registration ${status}`);
    if (status === "approved") {
      const reg = registrations.find(r => r.id === id);
      if (reg) {
        try {
          const event = events.find(e => e.id === reg.event_id);
          const tierName = (reg as any).custom_answers?.ticket_tier || null;
          await supabase.functions.invoke("send-approval-email", {
            body: { ticketId: reg.ticket_id, fullName: reg.full_name, email: reg.email, eventTitle: event?.title || "", eventSlug: reg.event_slug, attendeeType: (reg as any).attendee_type || "participant", tierName },
          });
          await supabase.from("registrations").update({ email_sent: true }).eq("id", id);
        } catch {
          await supabase.from("registrations").update({ email_sent: false }).eq("id", id);
        }
      }
    }
    fetchRegistrations();
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
    const reg = registrations.find(r => r.id === rejectingId);
    if (reg) {
      try {
        const event = events.find(e => e.id === reg.event_id);
        await supabase.functions.invoke("send-rejection-email", {
          body: { fullName: reg.full_name, email: reg.email, eventTitle: event?.title || "", rejectionReason: finalReason, rejectionDetails: rejectionReason === "Other" ? rejectionDetails : "" },
        });
        toast.success("Rejection email sent to attendee");
      } catch { toast.warning("Rejected but email failed to send"); }
    }
    toast.success("Registration rejected");
    setRejectingId(null);
    setRejecting(false);
    fetchRegistrations();
  };

  const deleteRegistration = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from("registrations").delete().eq("id", confirmDelete.id);
    if (error) { toast.error("Failed to delete registration"); setConfirmDelete(null); return; }
    toast.success("Registration deleted");
    setConfirmDelete(null);
    fetchRegistrations();
  };

  const clearAllRegistrations = async () => {
    if (!selectedEvent || selectedEvent === "all") { toast.error("Please select a specific event first"); setConfirmClearAll(false); return; }
    const { error } = await supabase.from("registrations").delete().eq("event_id", selectedEvent);
    if (error) { toast.error("Failed to clear registrations"); setConfirmClearAll(false); return; }
    toast.success("All registrations cleared");
    setConfirmClearAll(false);
    fetchRegistrations();
  };

  const viewReceipt = async (path: string) => {
    const isPdf = path.toLowerCase().endsWith(".pdf");
    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Unable to load receipt. Please try again.");
      return;
    }
    setReceiptModal({ url: data.signedUrl, isPdf });
  };

  const exportToExcel = (checkedInOnly = false) => {
    const dataToExport = checkedInOnly ? filtered.filter(r => r.checked_in) : filtered;
    if (dataToExport.length === 0) { toast.error("No data to export"); return; }
    // Collect all unique custom question labels across events
    const allQuestionLabels = new Set<string>();
    dataToExport.forEach(r => {
      if (r.custom_answers && typeof r.custom_answers === "object") {
        const questions = eventQuestions[r.event_id] || [];
        Object.keys(r.custom_answers).forEach(key => {
          if (key === "ticket_tier" || key === "ticket_tier_price") return;
          const qLabel = questions.find(q => q.id === key)?.label || key;
          allQuestionLabels.add(qLabel);
        });
      }
    });

    const exportData = dataToExport.map(r => {
      const base: Record<string, string> = {
        "Ticket ID": r.ticket_id, "Full Name": r.full_name, Email: r.email,
        Phone: r.phone, "Type": ATTENDEE_TYPE_LABELS[r.attendee_type] || r.attendee_type,
        "Payment Method": r.payment_method, Status: r.status,
        "RSVP": r.attendance_confirmed === "confirmed" ? "Confirmed" : r.attendance_confirmed === "cancelled" ? "Cancelled" : "Not Responded",
        Source: r.source === "imported" ? "Imported" : "Platform",
        "Checked In": r.checked_in ? "Yes" : "No",
        "Check-in Time": r.checked_in_at ? new Date(r.checked_in_at).toLocaleString() : "—",
        "Registered At": new Date(r.created_at).toLocaleString(),
        "QR Code URL": `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(r.ticket_id)}&bgcolor=FFFFFF&color=000000&margin=4&format=png&ecc=H`,
      };
      // Add custom answers as columns
      const questions = eventQuestions[r.event_id] || [];
      allQuestionLabels.forEach(label => {
        const qId = questions.find(q => q.label === label)?.id || label;
        const val = r.custom_answers?.[qId];
        base[label] = val ? (Array.isArray(val) ? val.join(", ") : String(val)) : "";
      });
      return base;
    });
    const eventName = selectedEvent !== "all"
      ? events.find(e => e.id === selectedEvent)?.title || "All-Events"
      : "All-Events";
    const dateStr = new Date().toISOString().split("T")[0];
    const suffix = checkedInOnly ? "_Checked-In" : "";
    const fileName = `${eventName.replace(/[^a-zA-Z0-9]/g, "-")}${suffix}_${dateStr}.xlsx`;
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, checkedInOnly ? "Checked-In" : "Registrations");
    XLSX.writeFile(wb, fileName);
  };

  const filtered = registrations.filter(r => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!r.full_name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q) && !r.ticket_id.toLowerCase().includes(q) && !r.phone.includes(q)) return false;
    }
    if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
    if (typeFilter !== "all" && r.attendee_type !== typeFilter) return false;
    if (checkinFilter === "checked_in" && !r.checked_in) return false;
    if (checkinFilter === "not_checked_in" && r.checked_in) return false;
    if (confirmFilter === "confirmed" && r.attendance_confirmed !== "confirmed") return false;
    if (confirmFilter === "cancelled" && r.attendance_confirmed !== "cancelled") return false;
    if (confirmFilter === "pending" && r.attendance_confirmed !== null) return false;
    return true;
  });

  const activeTypes = [...new Set(registrations.map(r => r.attendee_type))];

  return (
    <div className="space-y-4">
      {/* Source Tabs */}
      <div className="flex gap-1 rounded-lg bg-secondary p-1 flex-wrap">
        {[{ value: "all", label: "All" }, { value: "platform", label: "Platform" }, { value: "imported", label: "Imported" }, { value: "walk-in", label: "Walk-in" }].map(tab => (
          <button
            key={tab.value}
            onClick={() => setSourceFilter(tab.value)}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${sourceFilter === tab.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] opacity-70">
              {tab.value === "all" ? registrations.length : registrations.filter(r => r.source === tab.value).length}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
        <Select value={selectedEvent} onValueChange={setSelectedEvent}>
          <SelectTrigger className="w-full sm:w-[200px] border-border bg-secondary"><SelectValue placeholder="Filter by event" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px] border-border bg-secondary"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        {activeTypes.length > 1 && (
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[140px] border-border bg-secondary"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {activeTypes.map(t => <SelectItem key={t} value={t}>{ATTENDEE_TYPE_LABELS[t] || t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={checkinFilter} onValueChange={setCheckinFilter}>
          <SelectTrigger className="w-full sm:w-[160px] border-border bg-secondary"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Check-in</SelectItem>
            <SelectItem value="checked_in">Checked In</SelectItem>
            <SelectItem value="not_checked_in">Not Checked In</SelectItem>
          </SelectContent>
        </Select>
        <Select value={confirmFilter} onValueChange={setConfirmFilter}>
          <SelectTrigger className="w-full sm:w-[170px] border-border bg-secondary"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Attendance</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="pending">Not Responded</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => exportToExcel(false)} className="border-border hover:border-primary hover:text-primary shrink-0">
          <Download className="mr-2 h-4 w-4" /> Export All
        </Button>
        {(!subscriptionEnabled || userPlan === "pro" || userPlan === "corporate") ? (
          <Button variant="outline" onClick={() => exportToExcel(true)} className="border-border hover:border-primary hover:text-primary shrink-0">
            <Download className="mr-2 h-4 w-4" /> Export Checked-In
          </Button>
        ) : (
          <Button variant="outline" disabled className="border-border opacity-40 shrink-0" title="Checked-in export requires Pro or Corporate plan">
            <Download className="mr-2 h-4 w-4" /> Export Checked-In
          </Button>
        )}
        {selectedEvent && selectedEvent !== "all" && (() => {
          const ev = events.find(e => e.id === selectedEvent);
          return ev ? (
            <Button
              variant="outline"
              className="border-border hover:border-primary hover:text-primary shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(buildEventRSVPLink(ev.slug));
                toast.success("RSVP link copied!");
              }}
            >
              <Link className="mr-2 h-4 w-4" /> Copy RSVP Link
            </Button>
          ) : null;
        })()}
        {selectedEvent && selectedEvent !== "all" && (
          <Button variant="destructive" onClick={() => setConfirmClearAll(true)} className="shrink-0">
            <Trash2 className="mr-2 h-4 w-4" /> Clear All
          </Button>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((r, idx) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold text-muted-foreground mr-2">#{idx + 1}</span>
              <div>
                <p className="font-semibold text-foreground">{r.full_name}</p>
                <p className="text-xs font-mono text-primary">{r.ticket_id}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${ATTENDEE_TYPE_COLORS[r.attendee_type] || ATTENDEE_TYPE_COLORS.other}`}>
                  {ATTENDEE_TYPE_LABELS[r.attendee_type] || r.attendee_type}
                </span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.source === "imported" ? "bg-blue-500/10 text-blue-400" : r.source === "walk-in" ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                  {r.source === "imported" ? "Imported" : r.source === "walk-in" ? "Walk-in" : "Platform"}
                </span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === "approved" ? "bg-green-500/10 text-green-500" : r.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{r.status}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>{r.email} {r.email_sent === true ? "✅" : r.email_sent === false ? "❌" : ""}</p>
              <p>{r.phone}</p>
              <p>Payment: {r.payment_method}{r.bank_name ? ` (${r.bank_name})` : ""}</p>
              {r.checked_in && <p className="text-green-500">✓ Checked in{r.checked_in_at ? ` at ${new Date(r.checked_in_at).toLocaleString()}` : ""}</p>}
              <p className="flex items-center gap-1">Attendance: {r.attendance_confirmed === "confirmed" ? <span className="text-green-400 font-semibold">✓ Confirmed</span> : r.attendance_confirmed === "cancelled" ? <span className="text-destructive font-semibold">✗ Cancelled</span> : <span className="text-muted-foreground">Not responded</span>}</p>
              {r.custom_answers && Object.keys(r.custom_answers).filter(k => k !== "ticket_tier" && k !== "ticket_tier_price").length > 0 && (
                <button onClick={() => setExpandedResponses(expandedResponses === r.id ? null : r.id)} className="text-xs text-primary hover:underline mt-1">
                  {expandedResponses === r.id ? "Hide Responses" : "View Responses"}
                </button>
              )}
              {expandedResponses === r.id && r.custom_answers && (
                <div className="mt-2 space-y-1 rounded-lg border border-border bg-secondary/50 p-2">
                  {Object.entries(r.custom_answers).filter(([k]) => k !== "ticket_tier" && k !== "ticket_tier_price").map(([key, val]) => {
                    const questions = eventQuestions[r.event_id] || [];
                    const label = questions.find(q => q.id === key)?.label || key;
                    return (
                      <div key={key}>
                        <span className="font-medium text-foreground">{label}:</span>{" "}
                        <span className="text-muted-foreground">{Array.isArray(val) ? val.join(", ") : String(val)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              {r.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => updateStatus(r.id, "approved")} className="h-8 bg-green-500/10 text-green-500 hover:bg-green-500/20 border-0 flex-1 text-xs">Approve</Button>
                  <Button size="sm" onClick={() => openRejectDialog(r.id)} className="h-8 bg-destructive/10 text-destructive hover:bg-destructive/20 border-0 flex-1 text-xs">Reject</Button>
                </>
              )}
              {r.receipt_url && (
                <Button size="sm" variant="ghost" onClick={() => viewReceipt(r.receipt_url!)} className="h-8 text-xs"><Eye className="h-3 w-3 mr-1" /> Receipt</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ id: r.id, name: r.full_name })} className="h-8 text-destructive hover:text-destructive/80 text-xs"><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-12 text-center text-muted-foreground">No registrations found.</p>}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary">
            <tr>{["#", "Ticket ID", "Name", "Type", "Source", "Email", "Phone", "Payment", "Status", "RSVP", "Email", "Check-in", "Responses", "Actions"].map(h => <th key={h} className="px-3 py-3 text-left font-semibold text-foreground text-xs">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <React.Fragment key={r.id}>
              <tr className="border-b border-border hover:bg-secondary/50 transition-colors">
                <td className="px-3 py-3 text-xs font-bold text-muted-foreground">{idx + 1}</td>
                <td className="px-3 py-3 font-mono text-xs text-primary">{r.ticket_id}</td>
                <td className="px-3 py-3 text-foreground text-xs">{r.full_name}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${ATTENDEE_TYPE_COLORS[r.attendee_type] || ATTENDEE_TYPE_COLORS.other}`}>
                    {ATTENDEE_TYPE_LABELS[r.attendee_type] || r.attendee_type}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.source === "imported" ? "bg-blue-500/10 text-blue-400" : r.source === "walk-in" ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                    {r.source === "imported" ? "Imported" : r.source === "walk-in" ? "Walk-in" : "Platform"}
                  </span>
                </td>
                <td className="px-3 py-3 text-muted-foreground text-xs">{r.email}</td>
                <td className="px-3 py-3 text-muted-foreground text-xs">{r.phone}</td>
                <td className="px-3 py-3 text-muted-foreground text-xs">{r.payment_method}{r.bank_name ? ` (${r.bank_name})` : ""}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === "approved" ? "bg-green-500/10 text-green-400" : r.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{r.status}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.attendance_confirmed === "confirmed" ? "bg-green-500/10 text-green-400" : r.attendance_confirmed === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"}`}>
                      {r.attendance_confirmed === "confirmed" ? "✓ Yes" : r.attendance_confirmed === "cancelled" ? "✗ No" : "—"}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  {r.email_sent === true ? <span title="Email sent">✅</span> : r.email_sent === false ? <span title="Email failed">❌</span> : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-3">{r.checked_in ? <span className="text-xs text-green-400">✓ {r.checked_in_at ? new Date(r.checked_in_at).toLocaleString() : ""}</span> : <span className="text-xs text-muted-foreground">—</span>}</td>
                <td className="px-3 py-3">
                  {r.custom_answers && Object.keys(r.custom_answers).filter(k => k !== "ticket_tier" && k !== "ticket_tier_price").length > 0 ? (
                    <Button size="sm" variant="ghost" onClick={() => setExpandedResponses(expandedResponses === r.id ? null : r.id)} className="h-7 text-xs text-primary hover:text-primary/80">
                      <Eye className="h-3 w-3 mr-1" /> {expandedResponses === r.id ? "Hide" : "View"}
                    </Button>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    {r.status === "pending" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "approved")} className="h-8 text-green-400 hover:text-green-300"><CheckCircle className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => openRejectDialog(r.id)} className="h-8 text-destructive hover:text-destructive/80"><XCircle className="h-4 w-4" /></Button>
                      </>
                    )}
                    {r.receipt_url && <Button size="sm" variant="ghost" onClick={() => viewReceipt(r.receipt_url!)} className="h-8 text-muted-foreground hover:text-primary"><Eye className="h-4 w-4" /></Button>}
                    {r.status === "approved" && (
                      <Button size="sm" variant="ghost" className="h-8 text-muted-foreground hover:text-primary group relative">
                        <QrCode className="h-4 w-4" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden rounded-lg border border-border bg-white p-3 shadow-lg group-hover:block z-10">
                          <QRCodeSVG value={r.ticket_id} size={120} bgColor="#ffffff" fgColor="#000000" level="H" includeMargin />
                        </div>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ id: r.id, name: r.full_name })} className="h-8 text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
              {expandedResponses === r.id && r.custom_answers && (
                <tr className="bg-secondary/30">
                  <td colSpan={13} className="px-4 py-3">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      {Object.entries(r.custom_answers).filter(([k]) => k !== "ticket_tier" && k !== "ticket_tier_price").map(([key, val]) => {
                        const questions = eventQuestions[r.event_id] || [];
                        const label = questions.find(q => q.id === key)?.label || key;
                        return (
                          <div key={key}>
                            <span className="font-semibold text-foreground">{label}:</span>{" "}
                            <span className="text-muted-foreground">{Array.isArray(val) ? val.join(", ") : String(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
            {filtered.length === 0 && <tr><td colSpan={13} className="px-4 py-12 text-center text-muted-foreground">No registrations found.</td></tr>}
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

      {/* Receipt Modal */}
      {receiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setReceiptModal(null)}>
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl border border-border bg-card p-2" onClick={e => e.stopPropagation()}>
            <button onClick={() => setReceiptModal(null)} className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-1 text-foreground hover:text-primary">✕</button>
            {receiptModal.isPdf ? (
              <iframe src={receiptModal.url} title="Receipt" className="h-[70vh] w-full rounded-lg" />
            ) : (
              <img src={receiptModal.url} alt="Receipt" className="w-full rounded-lg" />
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete Registration"
        description={`Are you sure you want to delete the registration for "${confirmDelete?.name}"? This action cannot be undone.`}
        onConfirm={deleteRegistration}
      />

      <ConfirmDialog
        open={confirmClearAll}
        onOpenChange={setConfirmClearAll}
        title="Clear All Registrations"
        description={`Are you sure you want to delete ALL registrations for "${events.find(e => e.id === selectedEvent)?.title || "this event"}"? This action cannot be undone.`}
        confirmLabel="Clear All"
        onConfirm={clearAllRegistrations}
      />
    </div>
  );
};

export default OrganizerRegistrations;

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import * as XLSX from "xlsx";
import { Camera, ScanLine, Trash2, Download, Search, UserCheck } from "lucide-react";

interface Props { userId: string; isPaid?: boolean; onRequirePlan?: () => void; userPlan?: string; subscriptionEnabled?: boolean; }

interface CheckInRecord {
  name: string; ticketId: string; time: string; eventTitle: string; attendeeType: string;
}

const ATTENDEE_TYPE_LABELS: Record<string, string> = {
  participant: "Participant", vendor: "Vendor", speaker: "Speaker",
  vip: "VIP", media: "Media", other: "Other",
};

const ATTENDEE_TYPE_COLORS: Record<string, string> = {
  participant: "bg-blue-500/10 text-blue-400", vendor: "bg-amber-500/10 text-amber-400",
  speaker: "bg-purple-500/10 text-purple-400", vip: "bg-primary/10 text-primary",
  media: "bg-cyan-500/10 text-cyan-400", other: "bg-muted text-muted-foreground",
};

const OrganizerCheckin = ({ userId, isPaid = true, onRequirePlan, userPlan = "free", subscriptionEnabled = false }: Props) => {
  const [manualTicketId, setManualTicketId] = useState("");
  const [manualSearch, setManualSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [checkedInList, setCheckedInList] = useState<CheckInRecord[]>([]);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [totalApproved, setTotalApproved] = useState(0);
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    const { data: evs } = await supabase.from("events").select("id, title").eq("organizer_id", userId);
    if (!evs || evs.length === 0) return;
    setEvents(evs);

    const ids = evs.map(e => e.id);
    const { data: regs } = await supabase.from("registrations")
      .select("full_name, ticket_id, checked_in, checked_in_at, status, event_id, attendee_type")
      .in("event_id", ids);

    if (regs) {
      setTotalApproved(regs.filter(r => r.status === "approved").length);
      const checkedIn = regs.filter(r => r.checked_in && r.checked_in_at);
      setCheckedInCount(checkedIn.length);

      const evMap = Object.fromEntries(evs.map(e => [e.id, e.title]));
      const records: CheckInRecord[] = checkedIn
        .sort((a, b) => new Date(b.checked_in_at!).getTime() - new Date(a.checked_in_at!).getTime())
        .map(r => ({
          name: r.full_name, ticketId: r.ticket_id,
          time: new Date(r.checked_in_at!).toLocaleString(),
          eventTitle: evMap[r.event_id] || "Unknown",
          attendeeType: (r as any).attendee_type || "participant",
        }));
      setCheckedInList(records);
    }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time subscription
  useEffect(() => {
    if (events.length === 0) return;
    const ids = events.map(e => e.id);

    const channel = supabase
      .channel('checkin-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'registrations' }, (payload) => {
        const updated = payload.new as any;
        if (ids.includes(updated.event_id) && updated.checked_in && updated.checked_in_at) {
          const evTitle = events.find(e => e.id === updated.event_id)?.title || "Unknown";
          const newRecord: CheckInRecord = {
            name: updated.full_name, ticketId: updated.ticket_id,
            time: new Date(updated.checked_in_at).toLocaleString(),
            eventTitle: evTitle, attendeeType: updated.attendee_type || "participant",
          };
          setCheckedInList(prev => {
            if (prev.some(r => r.ticketId === newRecord.ticketId)) return prev;
            return [newRecord, ...prev];
          });
          setCheckedInCount(c => c + 1);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'registrations' }, (payload) => {
        const inserted = payload.new as any;
        if (ids.includes(inserted.event_id) && inserted.checked_in && inserted.checked_in_at) {
          const evTitle = events.find(e => e.id === inserted.event_id)?.title || "Unknown";
          const newRecord: CheckInRecord = {
            name: inserted.full_name, ticketId: inserted.ticket_id,
            time: new Date(inserted.checked_in_at).toLocaleString(),
            eventTitle: evTitle, attendeeType: inserted.attendee_type || "participant",
          };
          setCheckedInList(prev => {
            if (prev.some(r => r.ticketId === newRecord.ticketId)) return prev;
            return [newRecord, ...prev];
          });
          setCheckedInCount(c => c + 1);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [events]);

  const filteredList = checkedInList.filter(c => {
    if (selectedEvent !== "all") {
      const ev = events.find(e => e.title === c.eventTitle);
      if (ev?.id !== selectedEvent) return false;
    }
    if (typeFilter !== "all" && c.attendeeType !== typeFilter) return false;
    return true;
  });

  /** Extract ticket ID from scanned QR content — handles raw IDs, labels, and URLs */
  const extractTicketId = (scannedText: string): string => {
    const cleaned = scannedText
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[‐‑‒–—−]/g, "-")
      .trim();

    let decoded = cleaned;
    try {
      decoded = decodeURIComponent(cleaned);
    } catch {
      // keep original when not URL-encoded
    }

    const ticketMatch = decoded.match(/TKT[^A-Z0-9]*([A-Z0-9]{6,})/i);
    if (ticketMatch) return `TKT-${ticketMatch[1].toUpperCase()}`;

    try {
      const url = new URL(decoded);
      const ticketParam = url.searchParams.get("ticket") || url.searchParams.get("ticketId") || "";
      if (ticketParam) return extractTicketId(ticketParam);
      const segments = url.pathname.split("/").filter(Boolean);
      const last = segments[segments.length - 1];
      if (last) return extractTicketId(last);
    } catch {
      // not a URL
    }

    const compact = decoded.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (compact.startsWith("TKT") && compact.length > 6) {
      return `TKT-${compact.slice(3)}`;
    }

    return decoded.toUpperCase();
  };

  const checkIn = async (rawInput: string) => {
    const ticketId = extractTicketId(rawInput);
    if (!ticketId) return;
    if (!isPaid) { onRequirePlan?.(); return; }
    console.log("[Check-in] Raw scanned:", JSON.stringify(rawInput), "→ Extracted:", ticketId);
    const { data: reg, error: regError } = await supabase.from("registrations").select("*, event_id").eq("ticket_id", ticketId).single();
    if (!reg) {
      console.error("[Check-in] Not found. Error:", regError);
      toast.error(`Ticket not found: ${ticketId}`);
      return;
    }
    if (reg.status !== "approved") { toast.error("Ticket not approved"); return; }
    if (reg.checked_in) { toast.error("Already checked in!"); return; }

    const now = new Date().toISOString();
    const { data: { session } } = await supabase.auth.getSession();
    const staffId = session?.user?.id || null;
    const { error } = await supabase.from("registrations").update({ checked_in: true, checked_in_at: now, checked_in_by: staffId } as any).eq("ticket_id", ticketId.trim());
    if (error) { toast.error("Check-in failed"); return; }

    const evTitle = events.find(e => e.id === reg.event_id)?.title || "Unknown";
    const type = (reg as any).attendee_type || "participant";
    toast.success(`${reg.full_name} (${ATTENDEE_TYPE_LABELS[type] || type}) checked in!`);

    supabase.functions.invoke("send-checkin-email", {
      body: { ticketId: reg.ticket_id },
    }).catch(err => console.error("Check-in email failed:", err));

    setCheckedInList(prev => {
      if (prev.some(r => r.ticketId === reg.ticket_id)) return prev;
      return [{ name: reg.full_name, ticketId: reg.ticket_id, time: new Date(now).toLocaleString(), eventTitle: evTitle, attendeeType: type }, ...prev];
    });
    setCheckedInCount(c => c + 1);
    setManualSearch(""); setSearchResults([]);
  };

  // Manual search by name/email
  const handleManualSearch = async () => {
    if (!manualSearch.trim()) return;
    const eventIds = events.map(e => e.id);
    if (eventIds.length === 0) return;
    const q = manualSearch.trim().toLowerCase();
    const { data } = await supabase.from("registrations")
      .select("ticket_id, full_name, email, phone, checked_in, status, event_id, attendee_type")
      .in("event_id", eventIds)
      .eq("status", "approved")
      .eq("checked_in", false)
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    setSearchResults(data || []);
  };

  const clearList = () => { setCheckedInList([]); };

  const canExportCheckedIn = !subscriptionEnabled || userPlan === "pro" || userPlan === "corporate";

  const exportCheckedIn = () => {
    if (!canExportCheckedIn) {
      toast.error("Checked-in export requires the Pro or Corporate plan.");
      onRequirePlan?.();
      return;
    }
    if (filteredList.length === 0) { toast.error("No checked-in attendees to export"); return; }
    const exportData = filteredList.map(c => ({
      "Name": c.name, "Ticket ID": c.ticketId,
      "Type": ATTENDEE_TYPE_LABELS[c.attendeeType] || c.attendeeType,
      "Event": c.eventTitle, "Check-in Time": c.time,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Checked-In");
    XLSX.writeFile(wb, `Checked-In_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Checked-in attendees exported!");
  };

  const startScanner = async () => {
    setScannerActive(true);
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("org-qr-reader-checkin");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text) => { scanner.stop(); setScannerActive(false); checkIn(text); },
          () => {}
        );
      } catch { toast.error("Camera access denied"); setScannerActive(false); }
    }, 100);
  };

  const stopScanner = () => { scannerRef.current?.stop().catch(() => {}); setScannerActive(false); };

  const activeTypes = [...new Set(checkedInList.map(c => c.attendeeType))];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="font-display text-2xl font-bold text-foreground">{checkedInCount}</p>
          <p className="text-xs text-muted-foreground">Checked In</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="font-display text-2xl font-bold text-foreground">{totalApproved}</p>
          <p className="text-xs text-muted-foreground">Total Approved</p>
        </div>
      </div>

      {/* Check-in Station */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-primary" /> Check-in Station
        </h3>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex gap-2 flex-1">
            <Input placeholder="Enter Ticket ID..." value={manualTicketId} onChange={e => setManualTicketId(e.target.value)} className="border-border bg-secondary"
              onKeyDown={e => { if (e.key === "Enter") { checkIn(manualTicketId); setManualTicketId(""); } }} />
            <Button onClick={() => { checkIn(manualTicketId); setManualTicketId(""); }} className="bg-gradient-gold text-primary-foreground hover:opacity-90 shrink-0">Check In</Button>
          </div>
          <Button variant="outline" onClick={scannerActive ? stopScanner : startScanner} className="border-border hover:border-primary hover:text-primary">
            <Camera className="mr-2 h-4 w-4" /> {scannerActive ? "Stop" : "Scan QR"}
          </Button>
        </div>
        {scannerActive && (
          <div className="mx-auto max-w-sm overflow-hidden rounded-lg border border-primary/30">
            <div id="org-qr-reader-checkin" className="w-full" />
          </div>
        )}
      </div>

      {/* Manual Search Check-in */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" /> Find & Check In by Name/Email
        </h3>
        <p className="text-xs text-muted-foreground">For attendees who forgot their ticket — search by name, email, or phone.</p>
        <div className="flex gap-2">
          <Input placeholder="Search name, email, or phone..." value={manualSearch} onChange={e => setManualSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleManualSearch(); }} className="border-border bg-secondary" />
          <Button onClick={handleManualSearch} variant="outline" className="border-border shrink-0"><Search className="h-4 w-4" /></Button>
        </div>
        {searchResults.length > 0 && (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {searchResults.map(r => (
              <div key={r.ticket_id} className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{r.full_name}</p>
                  <p className="text-xs text-muted-foreground">{r.email} · {r.phone}</p>
                  <p className="text-xs text-muted-foreground font-mono">{r.ticket_id}</p>
                </div>
                <Button size="sm" onClick={() => checkIn(r.ticket_id)} className="bg-gradient-gold text-primary-foreground hover:opacity-90 h-8">
                  <UserCheck className="h-3 w-3 mr-1" /> Check In
                </Button>
              </div>
            ))}
          </div>
        )}
        {searchResults.length === 0 && manualSearch && (
          <p className="text-xs text-muted-foreground text-center py-2">No matching attendees found. Try a different search term.</p>
        )}
      </div>

      {/* Checked-in Records */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-display text-lg font-bold text-foreground">Checked-in Attendees ({filteredList.length})</h3>
          <div className="flex gap-2 flex-wrap">
            {events.length > 1 && (
              <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                <SelectTrigger className="w-[180px] border-border bg-secondary h-9"><SelectValue placeholder="Filter by event" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {activeTypes.length > 1 && (
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px] border-border bg-secondary h-9"><SelectValue placeholder="Filter type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {activeTypes.map(t => <SelectItem key={t} value={t}>{ATTENDEE_TYPE_LABELS[t] || t}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {filteredList.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportCheckedIn} className="border-border hover:border-primary hover:text-primary">
                <Download className="mr-1 h-3.5 w-3.5" /> Export
              </Button>
            )}
            {checkedInList.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearList} className="border-border hover:border-destructive hover:text-destructive">
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear List
              </Button>
            )}
          </div>
        </div>
        {filteredList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No check-ins yet</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredList.map((c, i) => (
              <div key={`${c.ticketId}-${i}`} className="flex items-center justify-between rounded-lg bg-green-500/5 border border-green-500/10 px-3 py-2 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-foreground font-medium">✓ {c.name}</span>
                  <span className="text-xs text-muted-foreground">({c.ticketId})</span>
                  <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${ATTENDEE_TYPE_COLORS[c.attendeeType] || ATTENDEE_TYPE_COLORS.other}`}>
                    {ATTENDEE_TYPE_LABELS[c.attendeeType] || c.attendeeType}
                  </span>
                  {events.length > 1 && <span className="text-xs text-primary">{c.eventTitle}</span>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{c.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizerCheckin;

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import { QRCodeSVG } from "qrcode.react";
import * as XLSX from "xlsx";
import { Camera, ScanLine, FileSpreadsheet, Loader2, Mail, Download, Users } from "lucide-react";
import { sendBulkTicketsChunked } from "@/lib/sendBulkTickets";

interface Props {
  userId: string;
}

interface ImportedReg {
  id: string;
  ticket_id: string;
  full_name: string;
  email: string;
  phone: string;
}

const OrganizerTickets = ({ userId }: Props) => {
  const [manualTicketId, setManualTicketId] = useState("");
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<{ name: string; ticketId: string; time: string }[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [allEvents, setAllEvents] = useState<{ id: string; title: string; slug: string }[]>([]);

  // Import state
  const [importMode, setImportMode] = useState<"event" | "standalone">("standalone");
  const [importEventId, setImportEventId] = useState("");
  const [standaloneName, setStandaloneName] = useState("");
  const [sendEmails, setSendEmails] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [lastImported, setLastImported] = useState<ImportedReg[]>([]);
  const [lastImportEventTitle, setLastImportEventTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [totalApproved, setTotalApproved] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const { data: evs } = await supabase.from("events").select("id, title, slug").eq("organizer_id", userId);
      if (evs) {
        setEvents(evs);
        const ids = evs.map(e => e.id);
        if (ids.length > 0) {
          const { data: regs } = await supabase.from("registrations").select("checked_in, status").in("event_id", ids);
          if (regs) {
            setCheckedInCount(regs.filter(r => r.checked_in).length);
            setTotalApproved(regs.filter(r => r.status === "approved").length);
          }
        }
      }
      const { data: all } = await supabase.from("events").select("id, title, slug").order("date");
      if (all) setAllEvents(all);
    };
    fetchData();
  }, [userId]);

  const checkIn = async (ticketId: string) => {
    if (!ticketId.trim()) return;
    const { data: reg } = await supabase.from("registrations").select("*").eq("ticket_id", ticketId.trim()).single();
    if (!reg) { toast.error("Ticket not found"); return; }
    if (reg.status !== "approved") { toast.error("Ticket not approved"); return; }
    if (reg.checked_in) { toast.error("Already checked in!"); return; }
    const { error } = await supabase.from("registrations").update({ checked_in: true, checked_in_at: new Date().toISOString() }).eq("ticket_id", ticketId.trim());
    if (error) { toast.error("Check-in failed"); return; }
    toast.success(`${reg.full_name} checked in!`);
    setRecentCheckIns(prev => [{ name: reg.full_name, ticketId: reg.ticket_id, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 10));
    setCheckedInCount(c => c + 1);
  };

  const startScanner = async () => {
    setScannerActive(true);
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("org-qr-reader-tickets");
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

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate based on mode
    if (importMode === "event" && !importEventId) {
      toast.error("Select an event first");
      return;
    }
    if (importMode === "standalone" && !standaloneName.trim()) {
      toast.error("Enter an event/group name");
      return;
    }

    setImporting(true);
    setLastImported([]);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(ws, {
        header: 1, defval: "", raw: false, blankrows: false,
      });

      if (!matrix.length) throw new Error("The uploaded file is empty");

      const normalize = (value: unknown) => String(value ?? "").trim();
      const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
      const headerHints = ["fullname", "name", "email", "emailaddress", "mail", "phonenumber", "phone", "mobile", "tel", "firstname", "lastname"];

      const detectedHeaderIndex = matrix.findIndex((row) =>
        row.some((cell) => {
          const key = normalizeKey(normalize(cell));
          return headerHints.some((hint) => key.includes(hint));
        })
      );

      let headerNorm: string[] = [];
      let dataRows: string[][] = [];

      if (detectedHeaderIndex >= 0) {
        const headerRow = matrix[detectedHeaderIndex].map((cell, idx) => normalize(cell) || `column_${idx + 1}`);
        headerNorm = headerRow.map(normalizeKey);
        dataRows = matrix.slice(detectedHeaderIndex + 1).map((row) => {
          const cells = row.map(normalize);
          while (cells.length < headerNorm.length) cells.push("");
          return cells;
        });
      } else {
        const maxColumns = Math.max(...matrix.map((row) => row.length), 0);
        if (!maxColumns) throw new Error("Could not read columns from this file");
        headerNorm = Array.from({ length: maxColumns }, (_, idx) => `column${idx + 1}`);
        dataRows = matrix.map((row) => row.map(normalize));
      }

      dataRows = dataRows.filter(row => row.some(cell => cell.length > 0));

      let eventId: string;
      let eventSlug: string;
      let eventTitle: string;

      if (importMode === "event") {
        const event = allEvents.find(ev => ev.id === importEventId);
        if (!event) throw new Error("Event not found");
        eventId = event.id; eventSlug = event.slug; eventTitle = event.title;
      } else {
        const slug = standaloneName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();
        const { data: newEvent, error: eventErr } = await supabase.from("events").insert([{
          title: standaloneName.trim(), slug, category: "General",
          date: new Date().toISOString().split("T")[0], time: "00:00",
          location: "Imported", organizer_id: userId, is_published: false,
          ticket_price: "Free", short_description: "Auto-created for imported attendee check-in",
        }] as any).select("id, slug, title").single();
        if (eventErr || !newEvent) throw new Error(eventErr?.message || "Failed to create event");
        eventId = newEvent.id; eventSlug = newEvent.slug; eventTitle = newEvent.title;

        const { data: updatedEvents } = await supabase.from("events").select("id, title, slug").order("date");
        if (updatedEvents) setAllEvents(updatedEvents);
        const { data: myEvents } = await supabase.from("events").select("id, title, slug").eq("organizer_id", userId);
        if (myEvents) setEvents(myEvents);
      }

      const findIdx = (patterns: string[]) =>
        headerNorm.findIndex((header) => patterns.some((p) => header.includes(p)));

      const idxName = findIdx(["fullname", "name", "participant", "attendee", "firstname"]);
      const idxLastName = findIdx(["lastname", "surname", "familyname"]);
      const idxEmail = findIdx(["emailaddress", "email", "mail"]);
      const idxPhone = findIdx(["phonenumber", "phone", "mobile", "tel", "contact"]);
      const idxPayment = findIdx(["paymentmethod", "payment"]);

      const emailRegex = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
      const isEmail = (v: string) => emailRegex.test(v.trim());

      const toInsert = dataRows.map((cells) => {
        const emailByH = idxEmail >= 0 ? cells[idxEmail]?.trim().toLowerCase() : "";
        const emailFb = (cells.find((v) => isEmail(v)) || "").trim().toLowerCase();
        const email = isEmail(emailByH) ? emailByH : emailFb;

        let full_name = "";
        if (idxName >= 0) {
          full_name = (cells[idxName] || "").replace(/\s+/g, " ").trim();
          if (idxLastName >= 0 && cells[idxLastName]) {
            const ln = cells[idxLastName].trim();
            if (ln && !full_name.toLowerCase().includes(ln.toLowerCase())) {
              full_name = `${full_name} ${ln}`.trim();
            }
          }
        }
        if (!full_name) {
          for (const cell of cells) {
            if (cell && !isEmail(cell) && !/^\+?\d[\d\s-]*$/.test(cell) && cell.length >= 2) {
              full_name = cell.replace(/\s+/g, " ").trim();
              break;
            }
          }
        }

        const phone = (idxPhone >= 0 ? cells[idxPhone] : cells.find(v => /^\+?\d[\d\s-]{6,}$/.test(v))) || "N/A";
        const payment = (idxPayment >= 0 ? cells[idxPayment] : "") || "imported";

        return {
          event_id: eventId, event_slug: eventSlug,
          full_name, email,
          phone: String(phone).trim() || "N/A",
          payment_method: String(payment).trim() || "imported",
          status: "approved",
        };
      }).filter(r => r.full_name.length >= 1 && isEmail(r.email));

      if (toInsert.length === 0) {
        toast.error("No valid rows. Need columns: Full Name, Email");
        setImporting(false);
        return;
      }

      const { data: inserted, error } = await supabase.from("registrations").insert(toInsert).select("id, ticket_id, full_name, email, phone");
      if (error) throw error;

      const importedRegs: ImportedReg[] = (inserted || []).map((r: any) => ({
        id: r.id,
        ticket_id: r.ticket_id,
        full_name: r.full_name,
        email: r.email,
        phone: r.phone,
      }));

      setLastImported(importedRegs);
      setLastImportEventTitle(eventTitle);
      toast.success(`${importedRegs.length} attendees imported with ticket IDs generated!`);

      // Auto-send emails if toggled
      if (sendEmails && importedRegs.length > 0) {
        setSendingEmails(true);
        try {
          const result = await sendBulkTicketsChunked({
            eventTitle,
            registrations: importedRegs.map(r => ({
              ticketId: r.ticket_id,
              fullName: r.full_name,
              email: r.email,
              registrationId: r.id,
            })),
          });
          toast.success(`Emails sent: ${result?.sent || 0} delivered, ${result?.failed || 0} failed`);
        } catch (err: any) {
          toast.error("Some emails failed to send: " + (err.message || "Unknown error"));
        }
        setSendingEmails(false);
      }

      // Update stats
      setTotalApproved(prev => prev + importedRegs.length);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendEmailsForImported = async () => {
    if (lastImported.length === 0) return;
    setSendingEmails(true);
    try {
      const result = await sendBulkTicketsChunked({
        eventTitle: lastImportEventTitle,
        registrations: lastImported.map(r => ({
          ticketId: r.ticket_id,
          fullName: r.full_name,
          email: r.email,
          registrationId: r.id,
        })),
      });
      toast.success(`Emails sent: ${result?.sent || 0} delivered, ${result?.failed || 0} failed`);
    } catch (err: any) {
      toast.error("Failed: " + (err.message || "Unknown error"));
    }
    setSendingEmails(false);
  };

  const exportImportedTickets = () => {
    if (lastImported.length === 0) return;
    const exportData = lastImported.map(r => ({
      "Ticket ID": r.ticket_id,
      "Full Name": r.full_name,
      "Email": r.email,
      "Phone": r.phone,
      "QR Code URL": `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(r.ticket_id)}`,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wbOut = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbOut, ws, "Tickets");
    XLSX.writeFile(wbOut, `tickets-${Date.now()}.xlsx`);
    toast.success("Ticket list exported!");
  };

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
            <div id="org-qr-reader-tickets" className="w-full" />
          </div>
        )}
        {recentCheckIns.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">Recent Check-ins</h4>
            {recentCheckIns.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-green-500/5 px-3 py-2 text-sm">
                <span className="text-foreground">✓ {c.name}</span>
                <span className="text-xs text-muted-foreground">{c.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Import Attendees */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" /> Import Attendees from Excel
        </h3>
        <p className="text-sm text-muted-foreground">
          Import attendees and auto-generate <strong>Ticket IDs</strong> & <strong>QR codes</strong>. 
          Use <strong>standalone mode</strong> to use our platform purely for check-in without creating an event first.
        </p>

        {/* Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={importMode === "standalone" ? "default" : "outline"}
            size="sm"
            onClick={() => setImportMode("standalone")}
            className={importMode === "standalone" ? "bg-gradient-gold text-primary-foreground" : "border-border"}
          >
            Standalone (Check-in Only)
          </Button>
          <Button
            variant={importMode === "event" ? "default" : "outline"}
            size="sm"
            onClick={() => setImportMode("event")}
            className={importMode === "event" ? "bg-gradient-gold text-primary-foreground" : "border-border"}
          >
            Link to Existing Event
          </Button>
        </div>

        <div className="space-y-3">
          {importMode === "standalone" ? (
            <div className="space-y-2">
              <Label>Event / Group Name *</Label>
              <Input
                value={standaloneName}
                onChange={e => setStandaloneName(e.target.value)}
                placeholder="e.g. Music Night Dec 2026, Workshop Group A..."
                className="border-border bg-secondary"
              />
              <p className="text-xs text-muted-foreground">A private event will be created automatically for check-in management.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Select Event</Label>
              <Select value={importEventId} onValueChange={setImportEventId}>
                <SelectTrigger className="border-border bg-secondary"><SelectValue placeholder="Choose an event" /></SelectTrigger>
                <SelectContent>
                  {allEvents.length > 0 ? allEvents.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>) : <SelectItem value="none" disabled>No events</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Send Emails Toggle */}
          <label className="flex items-center gap-3 rounded-lg border border-border bg-secondary p-3 cursor-pointer hover:border-primary/50 transition-colors">
            <Checkbox checked={sendEmails} onCheckedChange={(v) => setSendEmails(!!v)} />
            <div>
              <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-primary" /> Send ticket emails automatically
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">Each attendee will receive an email with their Ticket ID and QR code</p>
            </div>
          </label>

          <div className="space-y-2">
            <Label>Excel File (.xlsx)</Label>
            <p className="text-xs text-muted-foreground">Required columns: <strong>Full Name</strong>, <strong>Email</strong>. Optional: <strong>Phone</strong>, <strong>Ticket ID</strong> (auto-generated if missing).</p>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImportExcel}
              disabled={importing || sendingEmails || (importMode === "event" && !importEventId) || (importMode === "standalone" && !standaloneName.trim())}
              className="border-border bg-secondary"
            />
          </div>

          {(importing || sendingEmails) && (
            <div className="flex items-center gap-2 text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              {importing ? "Importing attendees..." : "Sending ticket emails..."}
            </div>
          )}
        </div>
      </div>

      {/* Last Imported Results */}
      {lastImported.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Imported Attendees ({lastImported.length})
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportImportedTickets} className="border-border hover:border-primary hover:text-primary text-xs">
                <Download className="h-3 w-3 mr-1" /> Export Tickets
              </Button>
              {!sendEmails && (
                <Button size="sm" onClick={sendEmailsForImported} disabled={sendingEmails} className="bg-gradient-gold text-primary-foreground hover:opacity-90 text-xs">
                  {sendingEmails ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Mail className="h-3 w-3 mr-1" />}
                  Send Ticket Emails
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {lastImported.map(r => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary p-3">
                <div className="shrink-0">
                  <QRCodeSVG value={r.ticket_id} size={48} bgColor="#ffffff" fgColor="#000000" level="H" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono text-primary">{r.ticket_id}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizerTickets;

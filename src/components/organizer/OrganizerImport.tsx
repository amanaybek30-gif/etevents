import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Loader2, Mail, Download, Users, Trash2, FileText, Calendar, MapPin, Clock } from "lucide-react";
import { getRemainingSlotsByOrganizer, getPlanLabel } from "@/lib/registrationLimits";
import { sendBulkTicketsChunked } from "@/lib/sendBulkTickets";
import PlanLimitReachedDialog from "@/components/organizer/PlanLimitReachedDialog";

interface Props {
  userId: string;
  isPaid?: boolean;
  onRequirePlan?: () => void;
  userPlan?: string;
  onNavigateToSubscription?: () => void;
}

interface ImportedReg {
  id: string;
  ticket_id: string;
  full_name: string;
  email: string;
  phone: string;
}

interface ImportRecord {
  id: string;
  event_title: string;
  file_name: string;
  file_url: string | null;
  imported_count: number;
  created_at: string;
  event_id: string;
}

const OrganizerImport = ({ userId, isPaid = true, onRequirePlan, userPlan = "free", onNavigateToSubscription }: Props) => {
  const [events, setEvents] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [allEvents, setAllEvents] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [importMode, setImportMode] = useState<"event" | "standalone">("standalone");
  const [importEventId, setImportEventId] = useState("");
  const [standaloneName, setStandaloneName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDuration, setEventDuration] = useState("1");
  const [attendeeCategory, setAttendeeCategory] = useState("participant");
  const [customCategory, setCustomCategory] = useState("");
  const [sendEmails, setSendEmails] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [limitPlan, setLimitPlan] = useState("");
  const [sendingEmails, setSendingEmails] = useState(false);
  const [lastImported, setLastImported] = useState<ImportedReg[]>([]);
  const [lastImportEventTitle, setLastImportEventTitle] = useState("");
  const [importHistory, setImportHistory] = useState<ImportRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // For reuse of previously named events
  const [previousEventNames, setPreviousEventNames] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: evs }, { data: history }] = await Promise.all([
        supabase.from("events").select("id, title, slug").eq("organizer_id", userId).order("date"),
        supabase.from("attendee_imports").select("*").eq("organizer_id", userId).order("created_at", { ascending: false }),
      ]);
      if (evs) { setEvents(evs); setAllEvents(evs); }
      if (history) {
        setImportHistory(history as ImportRecord[]);
        // Extract unique event names from history for reuse
        const names = [...new Set((history as ImportRecord[]).map(h => h.event_title))];
        setPreviousEventNames(names);
      }
      setLoadingHistory(false);
    };
    fetchData();
  }, [userId]);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isPaid) { onRequirePlan?.(); if (fileInputRef.current) fileInputRef.current.value = ""; return; }
    if (importMode === "event" && !importEventId) { toast.error("Select an event first"); return; }
    if (importMode === "standalone" && !standaloneName.trim()) { toast.error("Enter an event/group name"); return; }
    if (importMode === "standalone" && !eventDate) { toast.error("Please select the event date"); return; }
    if (importMode === "standalone" && !eventTime.trim()) { toast.error("Please enter the event time"); return; }
    if (importMode === "standalone" && !eventLocation.trim()) { toast.error("Please enter the event location"); return; }

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
      const headerHints = ["fullname", "name", "email", "emailaddress", "mail", "phonenumber", "phone", "mobile", "tel", "firstname", "lastname", "surname"];

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

      let eventId: string, eventSlug: string, eventTitle: string;

      if (importMode === "event") {
        const event = allEvents.find(ev => ev.id === importEventId);
        if (!event) throw new Error("Event not found");
        eventId = event.id; eventSlug = event.slug; eventTitle = event.title;
      } else {
        // Check if an event with this name already exists for this organizer
        const existingEvent = allEvents.find(ev => ev.title.toLowerCase() === standaloneName.trim().toLowerCase());
        if (existingEvent) {
          eventId = existingEvent.id; eventSlug = existingEvent.slug; eventTitle = existingEvent.title;
        } else {
          const slug = standaloneName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();
          const durationDays = parseInt(eventDuration) || 1;
          const { data: newEvent, error: eventErr } = await supabase.from("events").insert([{
            title: standaloneName.trim(), slug, category: "General",
            date: eventDate, time: eventTime.trim() || "00:00",
            duration: `${durationDays} day${durationDays > 1 ? "s" : ""}`,
            location: eventLocation.trim() || "TBA", organizer_id: userId, is_published: false,
            ticket_price: "Free", short_description: "Auto-created for imported attendee check-in",
          }]).select("id, slug, title").single();
          if (eventErr || !newEvent) throw new Error(eventErr?.message || "Failed to create event");

          // Update subscription expiry based on event end date (not for corporate — corporate is strictly time-bound)
          const eventEndDate = new Date(eventDate);
          eventEndDate.setDate(eventEndDate.getDate() + durationDays);
          const { data: currentProfile } = await supabase.from("organizer_profiles")
            .select("subscription_expires_at, subscription_plan")
            .eq("user_id", userId).single();
          if (currentProfile?.subscription_plan !== "corporate") {
            const currentExpiry = currentProfile?.subscription_expires_at ? new Date(currentProfile.subscription_expires_at) : null;
            if (!currentExpiry || eventEndDate > currentExpiry) {
              await supabase.from("organizer_profiles")
                .update({ subscription_expires_at: eventEndDate.toISOString() })
                .eq("user_id", userId);
            }
          }
          eventId = newEvent.id; eventSlug = newEvent.slug; eventTitle = newEvent.title;

          const { data: updatedEvents } = await supabase.from("events").select("id, title, slug").eq("organizer_id", userId).order("date");
          if (updatedEvents) { setEvents(updatedEvents); setAllEvents(updatedEvents); }
        }
      }

      const findIndex = (patterns: string[]) =>
        headerNorm.findIndex((header) => patterns.some((pattern) => header.includes(pattern)));

      const idxName = findIndex(["fullname", "name", "participant", "attendee", "registrant", "firstname"]);
      const idxLastName = findIndex(["lastname", "surname", "familyname"]);
      const idxEmail = findIndex(["emailaddress", "email", "mail"]);
      const idxPhone = findIndex(["phonenumber", "phone", "mobile", "tel", "contact"]);
      const idxPayment = findIndex(["paymentmethod", "payment", "bank", "telebirr", "mpesa", "cbe"]);

      const emailRegex = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
      const isEmail = (value: string) => emailRegex.test(value.trim());

      const normalizeEmail = (value: string) => value.trim().toLowerCase();
      const normalizeName = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 200);
      const normalizePhone = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return "0000000";
        const plusSafe = trimmed.replace(/[^\d+\s-]/g, "").replace(/\s+/g, "");
        const digitsOnly = trimmed.replace(/\D/g, "");
        if (plusSafe.length >= 7 && plusSafe.length <= 20) return plusSafe;
        if (digitsOnly.length >= 7 && digitsOnly.length <= 20) return digitsOnly;
        if (digitsOnly.length > 20) return digitsOnly.slice(0, 20);
        return "0000000";
      };

      const toInsert = dataRows.map((cells) => {
        const emailByHeader = idxEmail >= 0 ? normalizeEmail(cells[idxEmail] || "") : "";
        const emailFallback = normalizeEmail(cells.find((value) => isEmail(value)) || "");
        const email = isEmail(emailByHeader) ? emailByHeader : emailFallback;

        let full_name = "";
        if (idxName >= 0) {
          full_name = normalizeName(cells[idxName] || "");
          if (idxLastName >= 0 && cells[idxLastName]) {
            const lastName = normalizeName(cells[idxLastName] || "");
            if (lastName && !full_name.toLowerCase().includes(lastName.toLowerCase())) {
              full_name = normalizeName(`${full_name} ${lastName}`);
            }
          }
        }
        if (!full_name) {
          for (const cell of cells) {
            if (cell && !isEmail(cell) && !/^\+?\d[\d\s-]*$/.test(cell) && cell.length >= 2) {
              full_name = normalizeName(cell);
              break;
            }
          }
        }

        const phoneByHeader = idxPhone >= 0 ? normalizePhone(cells[idxPhone] || "") : "";
        const phoneFallback = normalizePhone(cells.find((value) => /^\+?\d[\d\s-]{6,}$/.test(value)) || "");
        const paymentByHeader = idxPayment >= 0 ? cells[idxPayment] || "" : "";

        const resolvedCategory = attendeeCategory === "other" && customCategory.trim() ? customCategory.trim() : attendeeCategory;

        return {
          event_id: eventId,
          event_slug: eventSlug,
          full_name,
          email,
          phone: phoneByHeader || phoneFallback || "0000000",
          payment_method: String(paymentByHeader || "imported").trim() || "imported",
          status: "approved",
          source: "imported",
          attendee_type: resolvedCategory,
        };
      }).filter((row) => row.full_name.length >= 1 && isEmail(row.email));

      if (toInsert.length === 0) { toast.error("No valid rows found with both name and valid email"); setImporting(false); return; }

      // Enforce global registration cap based on plan
      let cappedInsert = toInsert;
      let wasCapped = false;
      const { remaining, plan, limit } = await getRemainingSlotsByOrganizer(userId);
      if (plan !== "corporate") {
        if (remaining === 0) {
          setLimitPlan(plan);
          setShowLimitDialog(true);
          setImporting(false);
          return;
        }
        if (toInsert.length > remaining) {
          cappedInsert = toInsert.slice(0, remaining);
          wasCapped = true;
        }
      }

      const { data: inserted, error } = await supabase.from("registrations").insert(cappedInsert).select("id, ticket_id, full_name, email, phone");
      if (error) throw new Error(error.message || "Failed to insert registrations");

      const importedRegs: ImportedReg[] = (inserted || []).map((r: any) => ({
        id: r.id, ticket_id: r.ticket_id, full_name: r.full_name, email: r.email, phone: r.phone,
      }));
      setLastImported(importedRegs);
      setLastImportEventTitle(eventTitle);

      const filePath = `${userId}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("imports").upload(filePath, file);
      let fileUrl: string | null = null;
      if (!uploadErr) {
        const { data: signedData } = await supabase.storage.from("imports").createSignedUrl(filePath, 86400 * 365);
        fileUrl = signedData?.signedUrl || null;
      }

      const { data: importRecord } = await supabase.from("attendee_imports").insert({
        organizer_id: userId,
        event_id: eventId,
        event_title: eventTitle,
        file_name: file.name,
        file_url: filePath,
        imported_count: importedRegs.length,
        event_date: importMode === "standalone" ? eventDate : undefined,
        event_duration: importMode === "standalone" ? `${parseInt(eventDuration) || 1} day${(parseInt(eventDuration) || 1) > 1 ? "s" : ""}` : undefined,
      } as any).select("*").single();

      if (importRecord) {
        setImportHistory(prev => [importRecord as ImportRecord, ...prev]);
        if (!previousEventNames.includes(eventTitle)) {
          setPreviousEventNames(prev => [eventTitle, ...prev]);
        }
      }

      const skippedRows = Math.max(dataRows.length - cappedInsert.length, 0);
      if (wasCapped) {
        toast.warning(`Only ${cappedInsert.length} attendees were imported. Your ${getPlanLabel(plan)} plan allows up to ${limit} total attendees across all events. Upgrade to import more.`, { duration: 8000 });
      } else {
        toast.success(`${importedRegs.length} attendees imported${skippedRows > 0 ? `, ${skippedRows} skipped (missing valid name/email)` : ""}!`);
      }

      if (sendEmails && importedRegs.length > 0) {
        setSendingEmails(true);
        try {
          const result = await sendBulkTicketsChunked({
            eventTitle,
            registrations: importedRegs.map(r => ({ ticketId: r.ticket_id, fullName: r.full_name, email: r.email, registrationId: r.id })),
          });
          toast.success(`Emails sent: ${result?.sent || 0} delivered, ${result?.failed || 0} failed`);
        } catch (err: any) { toast.error("Some emails failed: " + (err?.message || "Unknown error")); }
        setSendingEmails(false);
      }
    } catch (err: any) { toast.error(err?.message || "Import failed. Please try again."); } finally {
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
        registrations: lastImported.map(r => ({ ticketId: r.ticket_id, fullName: r.full_name, email: r.email, registrationId: r.id })),
      });
      toast.success(`Emails sent: ${result?.sent || 0} delivered, ${result?.failed || 0} failed`);
    } catch (err: any) { toast.error("Failed: " + (err.message || "Unknown error")); }
    setSendingEmails(false);
  };

  const exportImportedTickets = () => {
    if (lastImported.length === 0) return;
    const exportData = lastImported.map(r => ({
      "Ticket ID": r.ticket_id, "Full Name": r.full_name, "Email": r.email, "Phone": r.phone,
      "QR Code URL": `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(r.ticket_id)}`,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wbOut = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbOut, ws, "Tickets");
    XLSX.writeFile(wbOut, `tickets-${Date.now()}.xlsx`);
    toast.success("Ticket list exported!");
  };

  const deleteImportRecord = async (record: ImportRecord) => {
    setDeletingId(record.id);
    try {
      if (record.file_url) {
        await supabase.storage.from("imports").remove([record.file_url]);
      }
      const { error } = await supabase.from("attendee_imports").delete().eq("id", record.id);
      if (error) throw error;
      setImportHistory(prev => prev.filter(r => r.id !== record.id));
      toast.success("Import record deleted");
    } catch (err: any) {
      toast.error("Failed to delete: " + (err.message || "Unknown error"));
    }
    setDeletingId(null);
  };

  const downloadImportFile = async (record: ImportRecord) => {
    if (!record.file_url) { toast.error("File not available"); return; }
    const { data, error } = await supabase.storage.from("imports").createSignedUrl(record.file_url, 3600);
    if (error || !data?.signedUrl) { toast.error("Unable to download file"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Import Form */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" /> Import Attendees from Excel
        </h3>
        <p className="text-sm text-muted-foreground">
          Import attendees and auto-generate <strong>Ticket IDs</strong> & <strong>QR codes</strong>.
          Use <strong>standalone mode</strong> to use our platform purely for check-in without creating an event first.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant={importMode === "standalone" ? "default" : "outline"} size="sm" onClick={() => setImportMode("standalone")}
            className={importMode === "standalone" ? "bg-gradient-gold text-primary-foreground" : "border-border"}>
            Standalone (Check-in Only)
          </Button>
          <Button variant={importMode === "event" ? "default" : "outline"} size="sm" onClick={() => setImportMode("event")}
            className={importMode === "event" ? "bg-gradient-gold text-primary-foreground" : "border-border"}>
            Link to Existing Event
          </Button>
        </div>

        <div className="space-y-3">
          {importMode === "standalone" ? (
            <div className="space-y-2">
              <Label>Event / Group Name *</Label>
              <Input value={standaloneName} onChange={e => setStandaloneName(e.target.value)}
                placeholder="e.g. Music Night Dec 2026, Workshop Group A..." className="border-border bg-secondary"
                list="previous-event-names" />
              <datalist id="previous-event-names">
                {previousEventNames.map((name, i) => <option key={i} value={name} />)}
                {allEvents.map(e => <option key={e.id} value={e.title} />)}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Tip: Type an existing event name to add attendees to it, or enter a new name to create one.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div className="space-y-1">
                  <Label className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> Event Date *
                  </Label>
                  <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
                    className="border-border bg-secondary" />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" /> Event Time *
                  </Label>
                  <Input value={eventTime} onChange={e => setEventTime(e.target.value)}
                    placeholder="e.g. 2:00 PM, 14:00..."
                    className="border-border bg-secondary" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> Event Location *
                  </Label>
                  <Input value={eventLocation} onChange={e => setEventLocation(e.target.value)}
                    placeholder="e.g. Skylight Hotel, Addis Ababa..."
                    className="border-border bg-secondary" />
                </div>
                <div className="space-y-1">
                  <Label>Duration (days)</Label>
                  <Select value={eventDuration} onValueChange={setEventDuration}>
                    <SelectTrigger className="border-border bg-secondary"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="2">2 days</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="4">4 days</SelectItem>
                      <SelectItem value="5">5 days</SelectItem>
                      <SelectItem value="7">7 days (1 week)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Your subscription remains active until the event ends. After that, you'll need to renew to create new events.
              </p>
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

          {/* Attendee Category */}
          <div className="space-y-2">
            <Label>Attendee Category</Label>
            <Select value={attendeeCategory} onValueChange={setAttendeeCategory}>
              <SelectTrigger className="border-border bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="participant">Participants</SelectItem>
                <SelectItem value="vip">VIPs</SelectItem>
                <SelectItem value="speaker">Speakers</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="vendor">Vendors</SelectItem>
                <SelectItem value="other">Other (Custom)</SelectItem>
              </SelectContent>
            </Select>
            {attendeeCategory === "other" && (
              <Input value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="Enter custom category..." className="border-border bg-secondary" />
            )}
            <p className="text-xs text-muted-foreground">All imported attendees will be categorized under this type</p>
          </div>

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
            <p className="text-xs text-muted-foreground">Flexible format: any Excel/CSV is accepted as long as each attendee row has a detectable <strong>Name</strong> and <strong>Email</strong>. Ticket IDs & QR codes are auto-generated.</p>
            <Input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportExcel}
              disabled={importing || sendingEmails || (importMode === "event" && !importEventId) || (importMode === "standalone" && (!standaloneName.trim() || !eventDate || !eventTime.trim() || !eventLocation.trim()))}
              className="border-border bg-secondary" />
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
            <div className="flex flex-wrap gap-2">
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

      {/* Import History */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Import History
        </h3>
        {loadingHistory ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : importHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No import records yet. Upload an Excel file above to get started.</p>
        ) : (
          <div className="space-y-2">
            {importHistory.map(record => (
              <div key={record.id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary p-3">
                <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{record.file_name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                    <span className="text-xs text-muted-foreground">{record.event_title}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" /> {record.imported_count}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {new Date(record.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => downloadImportFile(record)} className="h-8 w-8 p-0 text-muted-foreground hover:text-primary">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteImportRecord(record)} disabled={deletingId === record.id}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                    {deletingId === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <PlanLimitReachedDialog
        open={showLimitDialog}
        onOpenChange={setShowLimitDialog}
        plan={limitPlan}
        onNavigateToSubscription={() => onNavigateToSubscription?.()}
      />
    </div>
  );
};

export default OrganizerImport;

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Copy, ExternalLink, Send, Calendar, MapPin, Download,
  Megaphone, Users, Mail, Loader2, Lock, ChevronDown, ChevronUp, X,
  Upload, FileSpreadsheet, Plus, Trash2, Link as LinkIcon, ImagePlus
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import * as XLSX from "xlsx";
import { sendBulkTicketsChunked } from "@/lib/sendBulkTickets";

interface Props {
  userId: string;
  isPaid?: boolean;
  onRequirePlan?: () => void;
  userPlan?: string;
  subscriptionEnabled?: boolean;
}

interface PastAttendee {
  email: string;
  full_name: string;
  phone: string;
  event_title: string;
}

type ImportSource = "past-event" | "file";

const fuzzyMatch = (header: string, targets: string[]): boolean => {
  const h = header.toLowerCase().replace(/[^a-z]/g, "");
  return targets.some(t => h.includes(t));
};

const OrganizerPromotion = ({ userId, isPaid = true, onRequirePlan, userPlan = "free", subscriptionEnabled = false }: Props) => {
  const [events, setEvents] = useState<{ id: string; title: string; slug: string; date: string; location: string; ticket_price: string; image_url: string | null }[]>([]);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  // Bulk invite state
  const [importSource, setImportSource] = useState<ImportSource>("past-event");
  const [sourceEventId, setSourceEventId] = useState<string>("");
  const [targetEventId, setTargetEventId] = useState<string>("");
  const [pastAttendees, setPastAttendees] = useState<PastAttendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(new Set());
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailButtons, setEmailButtons] = useState<Array<{ text: string; url: string }>>([]);
  const [emailPhotos, setEmailPhotos] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const canBulkInvite = !subscriptionEnabled || userPlan === "pro" || userPlan === "corporate";
  const canAdvancedPromotion = !subscriptionEnabled || userPlan === "pro" || userPlan === "corporate";
  const pastInviteLimit = userPlan === "pro" ? 50 : Infinity; // Corporate = unlimited

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("events")
        .select("id, title, slug, date, location, ticket_price, image_url")
        .eq("organizer_id", userId).order("date", { ascending: false });
      if (data) setEvents(data);
    };
    fetch();
  }, [userId]);

  const eventLink = (slug: string) => `${window.location.origin}/event/${slug}`;
  const qrLink = (slug: string) => `${window.location.origin}/event/${slug}/quick-register`;

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(eventLink(slug));
    toast.success("Link copied!");
  };

  const shareToTelegram = (slug: string, title: string) => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(eventLink(slug))}&text=${encodeURIComponent(title)}`, "_blank");
  };

  const shareToWhatsApp = (slug: string, title: string) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${title}\n${eventLink(slug)}`)}`, "_blank");
  };

  const downloadQR = (slug: string) => {
    const svg = document.getElementById(`qr-promo-${slug}`);
    if (!svg) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new window.Image();
    img.onload = () => {
      canvas.width = 512; canvas.height = 512;
      ctx?.drawImage(img, 0, 0, 512, 512);
      const a = document.createElement("a");
      a.download = `QR-${slug}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    toast.success("QR code downloaded!");
  };

  const loadPastAttendees = async () => {
    if (!sourceEventId) {
      toast.error("Please select a source event");
      return;
    }
    setLoadingAttendees(true);
    try {
      const { data, error } = await supabase.from("registrations")
        .select("email, full_name, phone")
        .eq("event_id", sourceEventId)
        .neq("email", "")
        .not("email", "like", "%@self.local");

      if (error) throw error;

      const sourceEvent = events.find(e => e.id === sourceEventId);
      const attendees: PastAttendee[] = (data || []).map(r => ({
        email: r.email,
        full_name: r.full_name,
        phone: r.phone,
        event_title: sourceEvent?.title || "",
      }));

      // Deduplicate by email
      const unique = Array.from(new Map(attendees.map(a => [a.email.toLowerCase(), a])).values());
      
      // Enforce plan limit
      const limited = unique.slice(0, pastInviteLimit);
      setPastAttendees(limited);
      setSelectedAttendees(new Set(limited.map(a => a.email)));
      
      const limitMsg = pastInviteLimit < Infinity && unique.length > pastInviteLimit
        ? ` (limited to ${pastInviteLimit} on Pro plan)`
        : "";
      toast.success(`Loaded ${limited.length} attendees from "${sourceEvent?.title}"${limitMsg}`);
    } catch (err: any) {
      toast.error("Failed to load attendees: " + (err?.message || "Unknown error"));
    } finally {
      setLoadingAttendees(false);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (rows.length === 0) {
          toast.error("The file appears to be empty");
          return;
        }

        const headers = Object.keys(rows[0]);
        const nameCol = headers.find(h => fuzzyMatch(h, ["fullname", "name", "attendee", "participant"]));
        const emailCol = headers.find(h => fuzzyMatch(h, ["email", "mail"]));
        const phoneCol = headers.find(h => fuzzyMatch(h, ["phone", "tel", "mobile", "cell"]));

        if (!emailCol) {
          toast.error("Could not find an email column. Please include a column with 'email' in the header.");
          return;
        }

        const attendees: PastAttendee[] = rows
          .filter(r => {
            const email = String(r[emailCol] || "").trim().toLowerCase();
            return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.endsWith("@self.local");
          })
          .map(r => ({
            email: String(r[emailCol] || "").trim().toLowerCase(),
            full_name: nameCol ? String(r[nameCol] || "").trim() : "",
            phone: phoneCol ? String(r[phoneCol] || "").trim() : "",
            event_title: "Imported from file",
          }));

        const unique = Array.from(new Map(attendees.map(a => [a.email, a])).values());
        const limited = unique.slice(0, pastInviteLimit);
        setPastAttendees(limited);
        setSelectedAttendees(new Set(limited.map(a => a.email)));
        const limitMsg = pastInviteLimit < Infinity && unique.length > pastInviteLimit
          ? ` (limited to ${pastInviteLimit} on Pro plan)`
          : "";
        toast.success(`Imported ${limited.length} contacts from "${file.name}"${limitMsg}`);
      } catch (err: any) {
        toast.error("Failed to parse file: " + (err?.message || "Unknown error"));
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleAttendee = (email: string) => {
    setSelectedAttendees(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedAttendees.size === pastAttendees.length) {
      setSelectedAttendees(new Set());
    } else {
      setSelectedAttendees(new Set(pastAttendees.map(a => a.email)));
    }
  };

  const openEmailDialog = () => {
    if (selectedAttendees.size === 0) {
      toast.error("Select at least one attendee");
      return;
    }
    if (!targetEventId) {
      toast.error("Please select a target event to invite them to");
      return;
    }
    const target = events.find(e => e.id === targetEventId);
    if (target) {
      const link = eventLink(target.slug);
      setEmailSubject(`You're invited to ${target.title}!`);
      setEmailMessage(`Hi there!\n\nWe'd love to see you at our upcoming event:\n\n🎉 ${target.title}\n📅 ${target.date}\n📍 ${target.location}\n🎟️ ${target.ticket_price}\n\nRegister now: ${link}\n\nSee you there!`);
    }
    setShowEmailDialog(true);
  };

  const handleSendInvitations = async () => {
    if (!emailSubject.trim() || !emailMessage.trim()) {
      toast.error("Please enter both subject and message");
      return;
    }
    const recipients = pastAttendees.filter(a => selectedAttendees.has(a.email));
    if (recipients.length === 0) return;

    setSendingEmails(true);
    try {
      // Upload photos if any
      let imageUrls: string[] = [];
      if (emailPhotos.length > 0) {
        for (const photo of emailPhotos) {
          const fileName = `promo/${Date.now()}-${Math.random().toString(36).slice(2)}-${photo.name}`;
          const { error: uploadError } = await supabase.storage
            .from("advertisements")
            .upload(fileName, photo);
          if (uploadError) { toast.error("Failed to upload image"); setSendingEmails(false); return; }
          const { data: urlData } = supabase.storage.from("advertisements").getPublicUrl(fileName);
          imageUrls.push(urlData.publicUrl);
        }
      }

      const validButtons = emailButtons.filter(b => b.text.trim() && b.url.trim());

      const result = await sendBulkTicketsChunked({
        type: "custom_email",
        subject: emailSubject.trim(),
        message: emailMessage.trim(),
        recipients: recipients.map(r => ({ email: r.email, full_name: r.full_name })),
        buttons: validButtons.length > 0 ? validButtons : undefined,
        image_urls: imageUrls.length > 0 ? imageUrls : undefined,
      } as any);

      const sent = Number(result?.sent ?? 0);
      const failed = Number(result?.failed ?? 0);
      if (sent === 0) throw new Error("No invitations were delivered. Please retry.");

      if (failed > 0) {
        toast.warning(`Invitations sent to ${sent} attendees, ${failed} failed.`);
      } else {
        toast.success(`Invitations sent to ${sent} attendees!`);
      }
      setShowEmailDialog(false);
      setPastAttendees([]);
      setSelectedAttendees(new Set());
      setSourceEventId("");
      setEmailButtons([]);
      setEmailPhotos([]);
    } catch (err: any) {
      toast.error("Failed to send emails: " + (err?.message || "Unknown error"));
    } finally {
      setSendingEmails(false);
    }
  };

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center space-y-2">
        <Megaphone className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">No events to promote yet. Create an event first!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" /> Event Promotion Tools
        </h3>
        <p className="text-sm text-muted-foreground">Generate shareable assets for your events — QR codes, invite links, social sharing, and bulk email invitations.</p>
      </div>

      {/* Bulk Invite — Pro/Corporate only */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Bulk Email Invitations
          </h3>
          {!canBulkInvite && (
            <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
              <Lock className="h-3 w-3" /> Pro / Corporate
            </span>
          )}
        </div>

        {!canBulkInvite ? (
          <div className="rounded-lg bg-secondary border border-border p-4 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Import contacts from past events or external files (Excel/CSV) and send email invitations for upcoming events.</p>
            <Button size="sm" onClick={onRequirePlan} className="bg-gradient-gold text-primary-foreground">
              Upgrade to Pro or Corporate
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Load contacts from a past event or import from an external file, then send email invitations.</p>

            {/* Source Toggle */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={importSource === "past-event" ? "default" : "outline"}
                onClick={() => { setImportSource("past-event"); setPastAttendees([]); setSelectedAttendees(new Set()); }}
                className={importSource === "past-event" ? "bg-gradient-gold text-primary-foreground" : "border-border"}
              >
                <Users className="h-3.5 w-3.5 mr-1" /> From Past Event
              </Button>
              <Button
                size="sm"
                variant={importSource === "file" ? "default" : "outline"}
                onClick={() => { setImportSource("file"); setPastAttendees([]); setSelectedAttendees(new Set()); }}
                className={importSource === "file" ? "bg-gradient-gold text-primary-foreground" : "border-border"}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> From File (Excel/CSV)
              </Button>
            </div>

            {/* Target Event — always visible */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Target Event (invite to)</label>
              <select
                value={targetEventId}
                onChange={e => setTargetEventId(e.target.value)}
                className="w-full rounded-md border border-border bg-secondary text-foreground text-sm px-3 py-2"
              >
                <option value="">Select target event...</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.title} ({ev.date})</option>
                ))}
              </select>
            </div>

            {/* Past Event Source */}
            {importSource === "past-event" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">Source Event (import from)</label>
                  <select
                    value={sourceEventId}
                    onChange={e => { setSourceEventId(e.target.value); setPastAttendees([]); setSelectedAttendees(new Set()); }}
                    className="w-full rounded-md border border-border bg-secondary text-foreground text-sm px-3 py-2"
                  >
                    <option value="">Select past event...</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.title} ({ev.date})</option>
                    ))}
                  </select>
                </div>
                <Button
                  size="sm"
                  onClick={loadPastAttendees}
                  disabled={!sourceEventId || loadingAttendees}
                  className="bg-gradient-gold text-primary-foreground"
                >
                  {loadingAttendees ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Users className="h-4 w-4 mr-1" />}
                  Load Attendees
                </Button>
              </div>
            )}

            {/* File Import Source */}
            {importSource === "file" && (
              <div className="space-y-3">
                <div className="rounded-lg border-2 border-dashed border-border bg-secondary/50 p-6 text-center">
                  <FileSpreadsheet className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-1">Upload an Excel or CSV file with contact data</p>
                  <p className="text-xs text-muted-foreground mb-3">File must include an <strong className="text-foreground">email</strong> column. Name and phone columns are auto-detected.</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-border hover:border-primary hover:text-primary"
                  >
                    <Upload className="h-4 w-4 mr-1" /> Choose File
                  </Button>
                </div>
              </div>
            )}

            {pastAttendees.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground font-medium">{selectedAttendees.size} of {pastAttendees.length} attendees selected</p>
                  <Button size="sm" variant="ghost" onClick={toggleAll} className="text-xs text-muted-foreground hover:text-foreground">
                    {selectedAttendees.size === pastAttendees.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-secondary divide-y divide-border">
                  {pastAttendees.map(a => (
                    <label key={a.email} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={selectedAttendees.has(a.email)}
                        onChange={() => toggleAttendee(a.email)}
                        className="rounded border-border"
                      />
                      <span className="text-foreground font-medium truncate">{a.full_name}</span>
                      <span className="text-muted-foreground text-xs truncate ml-auto">{a.email}</span>
                    </label>
                  ))}
                </div>

                <Button
                  size="sm"
                  onClick={openEmailDialog}
                  disabled={selectedAttendees.size === 0 || !targetEventId}
                  className="bg-gradient-gold text-primary-foreground"
                >
                  <Mail className="h-4 w-4 mr-1" /> Compose & Send Invitations
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Per-Event Promotion Tools */}
      {events.map(e => {
        const link = eventLink(e.slug);
        const isExpanded = expandedEvent === e.id;
        return (
          <div key={e.id} className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
            <div className="flex items-start gap-3 cursor-pointer" onClick={() => setExpandedEvent(isExpanded ? null : e.id)}>
              {e.image_url && <img src={e.image_url} alt={e.title} className="h-16 w-24 rounded-lg object-cover shrink-0" />}
              <div className="flex-1 min-w-0">
                <h4 className="font-display text-base font-bold text-foreground">{e.title}</h4>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {e.date}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {e.location}</span>
                  <span className="text-primary font-medium">{e.ticket_price}</span>
                </div>
              </div>
              {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />}
            </div>

            {isExpanded && (
              <div className="space-y-4 pt-2">
                {/* Share Links */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Event Link</p>
                  <div className="flex items-center gap-2">
                    <Input value={link} readOnly className="border-border bg-secondary text-xs" />
                    <Button size="sm" onClick={() => copyLink(e.slug)} className="bg-gradient-gold text-primary-foreground shrink-0">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Social Sharing */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Share on Social</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => shareToTelegram(e.slug, e.title)} className="border-border hover:border-primary hover:text-primary text-xs">
                      <Send className="h-3 w-3 mr-1" /> Telegram
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => shareToWhatsApp(e.slug, e.title)} className="border-border hover:border-primary hover:text-primary text-xs">
                      <Send className="h-3 w-3 mr-1" /> WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" asChild className="border-border hover:border-primary hover:text-primary text-xs">
                      <a href={link} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3 mr-1" /> Preview</a>
                    </Button>
                  </div>
                </div>

                {/* QR Code */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">QR Code (Quick Registration)</p>
                  <div className="flex items-start gap-4">
                    <div className="bg-white p-3 rounded-lg border border-border">
                      <QRCodeSVG id={`qr-promo-${e.slug}`} value={qrLink(e.slug)} size={120} level="H" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">This QR code links directly to the quick registration page for your event.</p>
                      <Button size="sm" variant="outline" onClick={() => downloadQR(e.slug)} className="border-border hover:border-primary hover:text-primary text-xs">
                        <Download className="h-3 w-3 mr-1" /> Download QR
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Invite Text */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">Invite Message Template</p>
                  <div className="rounded-lg bg-secondary border border-border p-3">
                    <p className="text-xs text-foreground whitespace-pre-line">
                      {`🎉 You're invited to ${e.title}!\n\n📅 ${e.date}\n📍 ${e.location}\n🎟️ ${e.ticket_price}\n\nRegister now: ${link}`}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => {
                    navigator.clipboard.writeText(`🎉 You're invited to ${e.title}!\n\n📅 ${e.date}\n📍 ${e.location}\n🎟️ ${e.ticket_price}\n\nRegister now: ${link}`);
                    toast.success("Invite text copied!");
                  }} className="mt-1 text-xs text-muted-foreground hover:text-foreground">
                    <Copy className="h-3 w-3 mr-1" /> Copy Invite Text
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Email Compose Dialog */}
      {showEmailDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setShowEmailDialog(false)}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-foreground">Send Invitations</h3>
              <button onClick={() => setShowEmailDialog(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <p className="text-sm text-muted-foreground">
              Sending to <strong className="text-foreground">{selectedAttendees.size}</strong> attendee{selectedAttendees.size !== 1 ? "s" : ""} from past event
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Subject</label>
                <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="You're invited!" className="border-border bg-secondary" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Message</label>
                <Textarea
                  value={emailMessage}
                  onChange={e => setEmailMessage(e.target.value)}
                  placeholder="We'd love to see you at our upcoming event..."
                  className="border-border bg-secondary min-h-[120px]"
                />
              </div>

              {/* Images */}
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block flex items-center gap-1">
                  <ImagePlus className="h-3 w-3" /> Images ({emailPhotos.length}/5)
                </label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (emailPhotos.length + files.length > 5) {
                      toast.error("Maximum 5 images allowed");
                      return;
                    }
                    setEmailPhotos(prev => [...prev, ...files]);
                    if (photoInputRef.current) photoInputRef.current.value = "";
                  }}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2">
                  {emailPhotos.map((photo, i) => (
                    <div key={i} className="relative w-14 h-14 rounded-md overflow-hidden border border-border">
                      <img src={URL.createObjectURL(photo)} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setEmailPhotos(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-0 right-0 bg-destructive text-white rounded-bl p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {emailPhotos.length < 5 && (
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      className="w-14 h-14 rounded-md border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Custom Link Buttons */}
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" /> Link Buttons (optional)
                </label>
                <p className="text-[10px] text-muted-foreground mb-2">Add clickable buttons with links in the email</p>
                {emailButtons.map((btn, i) => (
                  <div key={i} className="flex gap-2 mb-2 items-center">
                    <Input
                      placeholder="Button text"
                      value={btn.text}
                      onChange={e => setEmailButtons(prev => prev.map((b, idx) => idx === i ? { ...b, text: e.target.value } : b))}
                      className="text-xs h-8 flex-1 border-border bg-secondary"
                    />
                    <Input
                      placeholder="https://..."
                      value={btn.url}
                      onChange={e => setEmailButtons(prev => prev.map((b, idx) => idx === i ? { ...b, url: e.target.value } : b))}
                      className="text-xs h-8 flex-1 border-border bg-secondary"
                    />
                    <button onClick={() => setEmailButtons(prev => prev.filter((_, idx) => idx !== i))} className="text-destructive hover:text-destructive/80">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {emailButtons.length < 3 && (
                  <Button variant="outline" size="sm" onClick={() => setEmailButtons(prev => [...prev, { text: "", url: "" }])} className="text-xs border-border">
                    <Plus className="h-3 w-3 mr-1" /> Add Button
                  </Button>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEmailDialog(false)} className="border-border">Cancel</Button>
              <Button onClick={handleSendInvitations} disabled={sendingEmails} className="bg-gradient-gold text-primary-foreground">
                {sendingEmails ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send to {selectedAttendees.size} Attendees
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizerPromotion;

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send, MessageCircle, Users, History, ImagePlus, X, Plus, Trash2, Link, Info } from "lucide-react";

interface Props {
  adminId: string;
}

interface Announcement {
  id: string;
  message: string;
  sent_count: number;
  created_at: string;
  events?: { title: string };
}

interface CustomButton {
  text: string;
  url: string;
  type: "url" | "info"; // url = link, info = callback with message
  infoMessage: string;
}

const AdminTelegram = ({ adminId }: Props) => {
  const [events, setEvents] = useState<Array<{ id: string; title: string; slug: string; organizer_id: string | null }>>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [connectedCounts, setConnectedCounts] = useState<Record<string, number>>({});
  const [totalConnected, setTotalConnected] = useState(0);
  const [photos, setPhotos] = useState<File[]>([]);
  const [customButtons, setCustomButtons] = useState<CustomButton[]>([]);
  const [audienceType, setAudienceType] = useState<"all" | "event" | "organizers" | "imported">("all");
  const [connectedOrganizers, setConnectedOrganizers] = useState(0);
  const [connectedImported, setConnectedImported] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: eventsData } = await supabase
      .from("events")
      .select("id, title, slug, organizer_id")
      .eq("is_published", true)
      .order("date", { ascending: false })
      .limit(100);

    setEvents(eventsData || []);

    const { data: anns } = await supabase
      .from("telegram_announcements")
      .select("id, message, sent_count, created_at, events!inner(title)")
      .order("created_at", { ascending: false })
      .limit(20) as any;

    setAnnouncements(anns || []);

    // Get ALL linked telegram accounts (those with chat_id and linked_at)
    const { data: allTgAccounts } = await supabase
      .from("telegram_accounts")
      .select("user_id, telegram_chat_id")
      .not("telegram_chat_id", "is", null)
      .not("linked_at", "is", null);

    const tgAccountsList = allTgAccounts || [];
    const tgUserIds = tgAccountsList.map(t => t.user_id);

    // Build email→chat_id map from attendee_accounts AND organizer_profiles
    const emailToChatId = new Map<string, number>();

    if (tgUserIds.length > 0) {
      // Batch: get attendee emails for these user_ids
      const { data: attendeeAccs } = await supabase
        .from("attendee_accounts")
        .select("user_id, email")
        .in("user_id", tgUserIds);

      // Batch: get organizer emails for these user_ids
      const { data: orgAccs } = await supabase
        .from("organizer_profiles")
        .select("user_id, email")
        .in("user_id", tgUserIds);

      const userIdToChatId = new Map<string, number>();
      tgAccountsList.forEach(t => {
        if (t.telegram_chat_id) userIdToChatId.set(t.user_id, t.telegram_chat_id);
      });

      attendeeAccs?.forEach(a => {
        const chatId = userIdToChatId.get(a.user_id);
        if (chatId && a.email) emailToChatId.set(a.email.toLowerCase(), chatId);
      });

      let orgConnectedCount = 0;
      orgAccs?.forEach(o => {
        const chatId = userIdToChatId.get(o.user_id);
        if (chatId) {
          orgConnectedCount++;
          if (o.email) emailToChatId.set(o.email.toLowerCase(), chatId);
        }
      });
      setConnectedOrganizers(orgConnectedCount);
    } else {
      setConnectedOrganizers(0);
      setConnectedImported(0);
    }

    // Count imported attendees connected to telegram
    if (emailToChatId.size > 0) {
      const { data: importedRegs } = await supabase
        .from("registrations")
        .select("email")
        .eq("source", "imported")
        .in("status", ["approved", "pending"]);

      const importedEmails = [...new Set((importedRegs || []).map(r => r.email.toLowerCase()))];
      let importedConnected = 0;
      for (const email of importedEmails) {
        if (emailToChatId.has(email)) importedConnected++;
      }
      setConnectedImported(importedConnected);
    }

    // Count per event
    if (eventsData && eventsData.length > 0) {
      const counts: Record<string, number> = {};
      const allChatIds = new Set<number>();

      for (const event of eventsData) {
        const { data: regs } = await supabase
          .from("registrations")
          .select("email")
          .eq("event_id", event.id)
          .in("status", ["approved", "pending"]);

        if (!regs) { counts[event.id] = 0; continue; }

        const emails = [...new Set(regs.map(r => r.email.toLowerCase()))];
        let eventConnected = 0;

        for (const email of emails) {
          const chatId = emailToChatId.get(email);
          if (chatId) {
            eventConnected++;
            allChatIds.add(chatId);
          }
        }
        counts[event.id] = eventConnected;
      }

      setConnectedCounts(counts);
      // Total should match dashboard: count ALL unique linked telegram accounts
      setTotalConnected(tgAccountsList.length);
    } else {
      setTotalConnected(tgAccountsList.length);
    }

    setLoading(false);
  };

  const handleAddPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > 10) {
      toast.error("Maximum 10 images allowed");
      return;
    }
    setPhotos(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const addCustomButton = () => {
    if (customButtons.length >= 5) {
      toast.error("Maximum 5 buttons allowed");
      return;
    }
    setCustomButtons(prev => [...prev, { text: "", url: "", type: "url", infoMessage: "" }]);
  };

  const updateCustomButton = (index: number, field: keyof CustomButton, value: string) => {
    setCustomButtons(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
  };

  const removeCustomButton = (index: number) => {
    setCustomButtons(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendAnnouncement = async () => {
    if ((audienceType === "event" || audienceType === "imported") && !selectedEvent) { toast.error("Please select an event"); return; }
    if (!message.trim() && photos.length === 0) { toast.error("Please enter a message or add photos"); return; }
    if (message.trim().length > 2000) { toast.error("Message must be under 2000 characters"); return; }

    // Validate buttons
    const validButtons = customButtons.filter(b => {
      if (!b.text.trim()) return false;
      if (b.type === "url" && !b.url.trim()) return false;
      if (b.type === "info" && !b.infoMessage.trim()) return false;
      return true;
    });

    setSending(true);
    try {
      const event = events.find((e) => e.id === selectedEvent);
      const fullMessage = audienceType === "organizers"
        ? `📢 *Platform Update*\n\n${message.trim()}`
        : audienceType === "all"
        ? `📢 *Announcement*\n\n${message.trim()}`
        : audienceType === "imported"
        ? `📢 *Update for ${event?.title || "Event"}*\n\n${message.trim()}`
        : `📢 *Update from ${event?.title || "Event"}*\n\n${message.trim()}`;

      let reply_markup: any = undefined;
      const infoButtons: Array<{ key: string; text: string; message: string }> = [];
      if (validButtons.length > 0) {
        reply_markup = {
          inline_keyboard: validButtons.map((b, idx) => {
            if (b.type === "url") {
              return [{ text: b.text, url: b.url }];
            } else {
              const shortKey = `info_${Date.now().toString(36)}_${idx}`;
              infoButtons.push({ key: shortKey, text: b.text, message: b.infoMessage });
              return [{ text: b.text, callback_data: shortKey }];
            }
          }),
        };
      }

      // Upload photos if any
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        for (const photo of photos) {
          const fileName = `telegram/${Date.now()}-${Math.random().toString(36).slice(2)}-${photo.name}`;
          const { error: uploadError } = await supabase.storage
            .from("advertisements")
            .upload(fileName, photo);
          if (uploadError) { toast.error("Failed to upload image"); setSending(false); return; }
          const { data: urlData } = supabase.storage.from("advertisements").getPublicUrl(fileName);
          photoUrls.push(urlData.publicUrl);
        }
      }

      const baseAction = photoUrls.length > 0 ? "broadcast_photos" : "broadcast";
      const action = audienceType === "all" ? (photoUrls.length > 0 ? "broadcast_all_photos" : "broadcast_all") : audienceType === "organizers" ? "broadcast_organizers" : audienceType === "imported" ? "broadcast_imported" : baseAction;

      const { data, error } = await supabase.functions.invoke("telegram-send", {
        body: {
          action,
          ...((audienceType === "event" || audienceType === "imported") ? { event_id: selectedEvent } : {}),
          message: fullMessage,
          ...(photoUrls.length > 0 ? { photo_urls: photoUrls } : {}),
          reply_markup,
          info_buttons: infoButtons.length > 0 ? infoButtons : undefined,
        },
      });
      if (error) throw error;
      const result = data as { sent?: number };
      toast.success(`Sent to ${result?.sent || 0} ${audienceType === "organizers" ? "organizers" : "users"}`);

      if (audienceType === "event" && selectedEvent) {
        await supabase.from("telegram_announcements").insert({
          event_id: selectedEvent,
          organizer_id: adminId,
          message: message.trim(),
          sent_count: 0,
        });
      }

      setMessage("");
      setPhotos([]);
      setCustomButtons([]);
      loadData();
    } catch (err: any) {
      toast.error("Failed to send: " + (err.message || "Unknown error"));
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-[#0088cc]" /> Telegram Management
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Send announcements, reminders, and updates to attendees via Telegram across all events
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Users className="h-5 w-5 mx-auto text-[#0088cc] mb-1" />
          <p className="text-2xl font-bold text-foreground">{totalConnected}</p>
          <p className="text-xs text-muted-foreground">Total Connected Users</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Send className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold text-foreground">{announcements.length}</p>
          <p className="text-xs text-muted-foreground">Announcements Sent</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <MessageCircle className="h-5 w-5 mx-auto text-green-500 mb-1" />
          <p className="text-2xl font-bold text-foreground">{events.length}</p>
          <p className="text-xs text-muted-foreground">Active Events</p>
        </div>
      </div>

      {/* Per-event connected counts */}
      {events.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4" /> Connected Users per Event
          </h3>
          <p className="text-xs text-muted-foreground">
            Includes all registered attendees (platform, imported, door) who have connected their Telegram
          </p>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {events.map(event => (
              <div key={event.id} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground truncate flex-1">{event.title}</span>
                <span className="text-xs font-bold text-foreground ml-2">
                  {connectedCounts[event.id] ?? 0} <span className="text-muted-foreground font-normal">connected</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send Announcement */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Send Update</h3>

        {/* Audience selector */}
        <div className="space-y-2">
          <Label className="text-xs">Audience</Label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAudienceType("all")}
              className={`rounded-full border px-4 py-1.5 text-sm transition-all ${audienceType === "all" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}
            >
              All Users ({totalConnected})
            </button>
            <button
              onClick={() => setAudienceType("event")}
              className={`rounded-full border px-4 py-1.5 text-sm transition-all ${audienceType === "event" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}
            >
              Event Attendees
            </button>
            <button
              onClick={() => setAudienceType("imported")}
              className={`rounded-full border px-4 py-1.5 text-sm transition-all ${audienceType === "imported" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}
            >
              Imported Attendees ({connectedImported})
            </button>
            <button
              onClick={() => setAudienceType("organizers")}
              className={`rounded-full border px-4 py-1.5 text-sm transition-all ${audienceType === "organizers" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}
            >
              Organizers ({connectedOrganizers})
            </button>
          </div>
        </div>

        {(audienceType === "event" || audienceType === "imported") && (
          <div className="space-y-2">
            <Label className="text-xs">Select Event</Label>
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger className="border-border bg-secondary">
                <SelectValue placeholder="Choose an event..." />
              </SelectTrigger>
              <SelectContent>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.title} ({connectedCounts[event.id] ?? 0} connected)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs">Message ({message.length}/2000)</Label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Write your update... (supports Markdown: *bold*, _italic_)"
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Photos */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1">
            <ImagePlus className="h-3 w-3" /> Photos ({photos.length}/10)
          </Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleAddPhoto}
            className="hidden"
          />
          <div className="flex flex-wrap gap-2">
            {photos.map((photo, i) => (
              <div key={i} className="relative w-16 h-16 rounded-md overflow-hidden border border-border">
                <img src={URL.createObjectURL(photo)} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute top-0 right-0 bg-destructive text-white rounded-bl p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {photos.length < 10 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-md border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Custom Buttons */}
        <div className="space-y-2">
          <Label className="text-xs">Custom Buttons (optional)</Label>
          <p className="text-[10px] text-muted-foreground">
            <strong>Link</strong> buttons open a URL. <strong>Info</strong> buttons show a message when tapped.
          </p>
          {customButtons.map((btn, i) => (
            <div key={i} className="space-y-1.5 p-2 rounded-lg bg-secondary/50 border border-border">
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Button text"
                  value={btn.text}
                  onChange={(e) => updateCustomButton(i, "text", e.target.value)}
                  className="text-xs h-8 flex-1"
                />
                <Select value={btn.type} onValueChange={(v) => updateCustomButton(i, "type", v)}>
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="url">
                      <span className="flex items-center gap-1"><Link className="h-3 w-3" /> Link</span>
                    </SelectItem>
                    <SelectItem value="info">
                      <span className="flex items-center gap-1"><Info className="h-3 w-3" /> Info</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <button onClick={() => removeCustomButton(i)} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {btn.type === "url" ? (
                <Input
                  placeholder="https://..."
                  value={btn.url}
                  onChange={(e) => updateCustomButton(i, "url", e.target.value)}
                  className="text-xs h-8"
                />
              ) : (
                <Textarea
                  placeholder="Message to show when user taps this button..."
                  value={btn.infoMessage}
                  onChange={(e) => updateCustomButton(i, "infoMessage", e.target.value)}
                  className="text-xs min-h-[60px]"
                  maxLength={500}
                />
              )}
            </div>
          ))}
          {customButtons.length < 5 && (
            <Button variant="outline" size="sm" onClick={addCustomButton} className="text-xs">
              <Plus className="h-3 w-3 mr-1" /> Add Button
            </Button>
          )}
        </div>

        <Button
          onClick={handleSendAnnouncement}
          disabled={sending || (audienceType === "event" && !selectedEvent) || (!message.trim() && photos.length === 0)}
          className="bg-[#0088cc] text-white hover:bg-[#0077b3] w-full"
        >
          {sending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {sending ? "Sending..." : photos.length > 0 ? `Send with ${photos.length} Photo(s)` : "Send via Telegram"}
        </Button>
      </div>

      {/* Past Announcements */}
      {announcements.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <History className="h-4 w-4" /> Recent Announcements
          </h3>
          <div className="space-y-3">
            {announcements.map((ann) => (
              <div key={ann.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-primary">
                    {(ann as any).events?.title || "Event"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(ann.created_at).toLocaleDateString()} · {ann.sent_count} sent
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{ann.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTelegram;

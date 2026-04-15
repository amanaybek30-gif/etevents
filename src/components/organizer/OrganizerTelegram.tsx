import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send, MessageCircle, Users, History, ImagePlus, X, Plus, Trash2 } from "lucide-react";
import ConnectTelegramButton from "@/components/ConnectTelegramButton";

interface Props {
  userId: string;
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
}

const OrganizerTelegram = ({ userId }: Props) => {
  const attendeeStatuses = ["approved", "pending"];
  const [events, setEvents] = useState<Array<{ id: string; title: string; slug: string }>>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [connectedCounts, setConnectedCounts] = useState<Record<string, number>>({});
  const [totalConnected, setTotalConnected] = useState(0);
  const [photos, setPhotos] = useState<File[]>([]);
  const [customButtons, setCustomButtons] = useState<CustomButton[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);

    const { data: eventsData } = await supabase
      .from("events")
      .select("id, title, slug")
      .eq("organizer_id", userId)
      .order("date", { ascending: false });

    setEvents(eventsData || []);

    const { data: anns } = await supabase
      .from("telegram_announcements")
      .select("id, message, sent_count, created_at, events!inner(title)")
      .eq("organizer_id", userId)
      .order("created_at", { ascending: false })
      .limit(10) as any;

    setAnnouncements(anns || []);

    // Count connected users per event
    if (eventsData && eventsData.length > 0) {
      const counts: Record<string, number> = {};
      let total = 0;
      const allChatIds = new Set<number>();

      for (const event of eventsData) {
        const { data: regs } = await supabase
          .from("registrations")
          .select("email")
          .eq("event_id", event.id)
          .in("status", attendeeStatuses);

        if (!regs) { counts[event.id] = 0; continue; }

        const emails = [...new Set(regs.map((r) => r.email))];
        let eventConnected = 0;

        for (const email of emails) {
          const { data: acc } = await supabase
            .from("attendee_accounts")
            .select("user_id")
            .ilike("email", email)
            .limit(1)
            .single() as any;
          if (acc) {
            const { data: tg } = await supabase
              .from("telegram_accounts")
              .select("telegram_chat_id")
              .eq("user_id", acc.user_id)
              .not("linked_at", "is", null)
              .limit(1)
              .single() as any;
            if (tg?.telegram_chat_id) {
              eventConnected++;
              if (!allChatIds.has(tg.telegram_chat_id)) {
                allChatIds.add(tg.telegram_chat_id);
                total++;
              }
            }
          }
        }
        counts[event.id] = eventConnected;
      }
      setConnectedCounts(counts);
      setTotalConnected(total);
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
    setCustomButtons(prev => [...prev, { text: "", url: "" }]);
  };

  const updateCustomButton = (index: number, field: "text" | "url", value: string) => {
    setCustomButtons(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
  };

  const removeCustomButton = (index: number) => {
    setCustomButtons(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendAnnouncement = async () => {
    if (!selectedEvent) { toast.error("Please select an event"); return; }
    if (!message.trim() && photos.length === 0) { toast.error("Please enter a message or add photos"); return; }
    if (message.trim().length > 2000) { toast.error("Message must be under 2000 characters"); return; }

    // Validate custom buttons
    const validButtons = customButtons.filter(b => b.text.trim() && b.url.trim());

    setSending(true);
    try {
      const event = events.find((e) => e.id === selectedEvent);
      const fullMessage = `📢 *Update from ${event?.title || "Event"}*\n\n${message.trim()}`;

      // Build reply_markup with custom buttons
      let reply_markup: any = undefined;
      if (validButtons.length > 0) {
        reply_markup = {
          inline_keyboard: validButtons.map(b => [{ text: b.text, url: b.url }]),
        };
      }

      if (photos.length > 0) {
        // Upload photos and get URLs
        const photoUrls: string[] = [];
        for (const photo of photos) {
          const fileName = `telegram/${Date.now()}-${Math.random().toString(36).slice(2)}-${photo.name}`;
          const { error: uploadError } = await supabase.storage
            .from("advertisements")
            .upload(fileName, photo);
          if (uploadError) { toast.error("Failed to upload image"); setSending(false); return; }
          const { data: urlData } = supabase.storage.from("advertisements").getPublicUrl(fileName);
          photoUrls.push(urlData.publicUrl);
        }

        const { data, error } = await supabase.functions.invoke("telegram-send", {
          body: {
            action: "broadcast_photos",
            event_id: selectedEvent,
            message: fullMessage,
            photo_urls: photoUrls,
            reply_markup,
          },
        });
        if (error) throw error;
        const result = data as { sent?: number };
        toast.success(`Update with ${photoUrls.length} photo(s) sent to ${result?.sent || 0} users`);
      } else {
        const { data, error } = await supabase.functions.invoke("telegram-send", {
          body: {
            action: "broadcast",
            event_id: selectedEvent,
            message: fullMessage,
            reply_markup,
          },
        });
        if (error) throw error;
        const result = data as { sent?: number };
        toast.success(`Announcement sent to ${result?.sent || 0} Telegram users`);
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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-[#0088cc]" /> Telegram Notifications
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Send announcements, photos, and updates to your attendees via Telegram
        </p>
      </div>

      {/* Your Connection */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Your Telegram Connection</h3>
        <ConnectTelegramButton userId={userId} role="organizer" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Users className="h-5 w-5 mx-auto text-[#0088cc] mb-1" />
          <p className="text-2xl font-bold text-foreground">{totalConnected}</p>
          <p className="text-xs text-muted-foreground">Total Connected Attendees</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Send className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold text-foreground">{announcements.length}</p>
          <p className="text-xs text-muted-foreground">Announcements Sent</p>
        </div>
      </div>

      {/* Per-event connected counts */}
      {events.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4" /> Connected Users per Event
          </h3>
          <div className="space-y-1">
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

        <div className="space-y-2">
          <Label className="text-xs">Select Event</Label>
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger className="border-border bg-secondary">
              <SelectValue placeholder="Choose an event..." />
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
          {customButtons.map((btn, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                placeholder="Button text"
                value={btn.text}
                onChange={(e) => updateCustomButton(i, "text", e.target.value)}
                className="text-xs h-8 flex-1"
              />
              <Input
                placeholder="https://..."
                value={btn.url}
                onChange={(e) => updateCustomButton(i, "url", e.target.value)}
                className="text-xs h-8 flex-1"
              />
              <button onClick={() => removeCustomButton(i)} className="text-destructive hover:text-destructive/80">
                <Trash2 className="h-4 w-4" />
              </button>
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
          disabled={sending || !selectedEvent || (!message.trim() && photos.length === 0)}
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

export default OrganizerTelegram;

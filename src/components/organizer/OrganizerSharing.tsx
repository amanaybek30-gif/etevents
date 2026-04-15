import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, ExternalLink, Send, Calendar, MapPin } from "lucide-react";
import { getShareUrl } from "@/lib/shareUrl";

interface Props {
  userId: string;
}

const OrganizerSharing = ({ userId }: Props) => {
  const [events, setEvents] = useState<{ id: string; title: string; slug: string; date: string; location: string }[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("events").select("id, title, slug, date, location").eq("organizer_id", userId).order("date", { ascending: false });
      if (data) setEvents(data);
    };
    fetch();
  }, [userId]);

  const copyLink = (slug: string) => {
    const link = getShareUrl(`/event/${slug}`);
    navigator.clipboard.writeText(link);
    toast.success("Link copied!");
  };

  const shareToTelegram = (slug: string, title: string) => {
    const link = getShareUrl(`/event/${slug}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(title)}`, "_blank");
  };

  const shareToWhatsApp = (slug: string, title: string) => {
    const link = getShareUrl(`/event/${slug}`);
    window.open(`https://wa.me/?text=${encodeURIComponent(`${title}\n${link}`)}`, "_blank");
  };

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-muted-foreground">No events to share yet. Create an event first!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map(e => {
        const link = getShareUrl(`/event/${e.slug}`);
        return (
          <div key={e.id} className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-3">
            <div>
              <h3 className="font-display text-base font-bold text-foreground">{e.title}</h3>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {e.date}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {e.location}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input value={link} readOnly className="border-border bg-secondary text-xs" />
              <Button size="sm" onClick={() => copyLink(e.slug)} className="bg-gradient-gold text-primary-foreground shrink-0">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
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
        );
      })}
    </div>
  );
};

export default OrganizerSharing;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Megaphone } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  message: string | null;
  image_url: string | null;
  link_url: string | null;
  link_text: string | null;
}

const AnnouncementBanner = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = sessionStorage.getItem("dismissed_announcements");
    if (stored) {
      try { setDismissed(new Set(JSON.parse(stored))); } catch {}
    }

    const fetchAnnouncements = async () => {
      const { data } = await supabase
        .from("admin_announcements")
        .select("id, title, message, image_url, link_url, link_text")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);
      setAnnouncements((data as Announcement[]) || []);
    };
    fetchAnnouncements();
  }, []);

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    sessionStorage.setItem("dismissed_announcements", JSON.stringify([...next]));
  };

  const visible = announcements.filter(a => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="w-full z-40">
      {visible.map(a => (
        <div
          key={a.id}
          className="w-full bg-gradient-to-r from-primary via-primary/90 to-primary border-b border-primary-foreground/10"
        >
          <div className="w-full px-4 py-2.5 flex items-center gap-3">
            <Megaphone className="h-4 w-4 text-primary-foreground shrink-0" />
            <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-bold text-primary-foreground">{a.title}</span>
              {a.message && (
                <span className="text-xs text-primary-foreground/80 truncate max-w-[50vw]">{a.message}</span>
              )}
              {a.link_url && (
                <a
                  href={a.link_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-primary-foreground underline underline-offset-2 hover:text-primary-foreground/80 shrink-0"
                >
                  {a.link_text || "Learn more"}
                </a>
              )}
            </div>
            <button
              onClick={() => dismiss(a.id)}
              className="text-primary-foreground/70 hover:text-primary-foreground shrink-0 p-0.5"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AnnouncementBanner;

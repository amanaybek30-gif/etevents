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
    <div className="z-40 w-full">
      {visible.map(a => (
        <div
          key={a.id}
          className="w-full border-b border-primary-foreground/10 bg-gradient-to-r from-primary via-primary/90 to-primary"
        >
          <div className="flex w-full items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
            <Megaphone className="h-3.5 w-3.5 shrink-0 text-primary-foreground sm:h-4 sm:w-4" />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-[11px] font-bold text-primary-foreground sm:text-sm">{a.title}</span>
              {a.message && (
                <span className="max-w-[48vw] truncate text-[10px] text-primary-foreground/80 sm:max-w-[50vw] sm:text-xs">{a.message}</span>
              )}
              {a.link_url && (
                <a
                  href={a.link_url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-[10px] font-semibold text-primary-foreground underline underline-offset-2 hover:text-primary-foreground/80 sm:text-xs"
                >
                  {a.link_text || "Learn more"}
                </a>
              )}
            </div>
            <button
              onClick={() => dismiss(a.id)}
              className="shrink-0 p-0.5 text-primary-foreground/70 hover:text-primary-foreground"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AnnouncementBanner;

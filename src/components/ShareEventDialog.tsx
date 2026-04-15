import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Copy, X, Mail } from "lucide-react";
import { toast } from "sonner";

interface Props {
  eventTitle: string;
  eventUrl: string;
}

const ShareEventDialog = ({ eventTitle, eventUrl }: Props) => {
  const [open, setOpen] = useState(false);

  const encodedUrl = encodeURIComponent(eventUrl);
  const encodedTitle = encodeURIComponent(eventTitle);
  const encodedText = encodeURIComponent(`Check out this event: ${eventTitle}`);

  const shareOptions = [
    { label: "Copy Link", icon: "copy" as const, action: () => { navigator.clipboard.writeText(eventUrl); toast.success("Link copied!"); setOpen(false); } },
    { label: "WhatsApp", icon: "whatsapp" as const, action: () => window.open(`https://wa.me/?text=${encodedText}%20${encodedUrl}`, "_blank") },
    { label: "Telegram", icon: "telegram" as const, action: () => window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`, "_blank") },
    { label: "Facebook", icon: "facebook" as const, action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, "_blank") },
    { label: "Email", icon: "email" as const, action: () => window.open(`mailto:?subject=${encodedTitle}&body=${encodedText}%20${encodedUrl}`) },
  ];

  const iconMap: Record<string, React.ReactNode> = {
    copy: <Copy className="h-4 w-4" />,
    whatsapp: <span className="text-sm font-bold">W</span>,
    telegram: <span className="text-sm font-bold">T</span>,
    facebook: <span className="text-sm font-bold">F</span>,
    email: <Mail className="h-4 w-4" />,
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="border-border hover:border-primary hover:text-primary">
        <Share2 className="mr-2 h-4 w-4" /> Share Event
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-foreground">Share Event</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-muted-foreground">{eventTitle}</p>
            <div className="grid grid-cols-2 gap-3">
              {shareOptions.map(opt => (
                <button
                  key={opt.label}
                  onClick={opt.action}
                  className="flex items-center gap-3 rounded-lg border border-border bg-secondary p-3 text-sm font-medium text-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  {iconMap[opt.icon]}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ShareEventDialog;

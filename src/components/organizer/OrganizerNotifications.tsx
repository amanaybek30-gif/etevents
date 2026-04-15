import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, CheckCircle, Clock, XCircle, Users } from "lucide-react";

interface Props {
  userId: string;
}

interface NotifItem {
  id: string;
  text: string;
  type: "registration" | "approved" | "rejected" | "checkin";
  time: string;
}

const OrganizerNotifications = ({ userId }: Props) => {
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: events } = await supabase.from("events").select("id, title").eq("organizer_id", userId);
      if (!events || events.length === 0) { setLoading(false); return; }

      const ids = events.map(e => e.id);
      const { data: regs } = await supabase.from("registrations")
        .select("full_name, status, checked_in, created_at, event_id, updated_at")
        .in("event_id", ids).order("updated_at", { ascending: false }).limit(30);

      if (regs) {
        const notifs: NotifItem[] = regs.map(r => {
          const evTitle = events.find(e => e.id === r.event_id)?.title || "";
          if (r.checked_in) return { id: `${r.event_id}-${r.full_name}-ci`, text: `${r.full_name} checked in — ${evTitle}`, type: "checkin" as const, time: r.updated_at };
          if (r.status === "approved") return { id: `${r.event_id}-${r.full_name}-a`, text: `${r.full_name} approved — ${evTitle}`, type: "approved" as const, time: r.updated_at };
          if (r.status === "rejected") return { id: `${r.event_id}-${r.full_name}-r`, text: `${r.full_name} rejected — ${evTitle}`, type: "rejected" as const, time: r.updated_at };
          return { id: `${r.event_id}-${r.full_name}-p`, text: `New registration: ${r.full_name} — ${evTitle}`, type: "registration" as const, time: r.created_at };
        });
        setNotifications(notifs);
      }
      setLoading(false);
    };
    fetch();
  }, [userId]);

  const iconFor = (type: string) => {
    switch (type) {
      case "approved": return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
      case "rejected": return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
      case "checkin": return <Users className="h-4 w-4 text-primary shrink-0" />;
      default: return <Clock className="h-4 w-4 text-yellow-500 shrink-0" />;
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-3">
      {notifications.length > 0 ? notifications.map(n => (
        <div key={n.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          {iconFor(n.type)}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground truncate">{n.text}</p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{new Date(n.time).toLocaleDateString()}</span>
        </div>
      )) : (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Bell className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No notifications yet.</p>
        </div>
      )}
    </div>
  );
};

export default OrganizerNotifications;

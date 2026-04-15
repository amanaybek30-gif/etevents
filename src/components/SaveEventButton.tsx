import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";

interface Props {
  eventId: string;
  className?: string;
}

const SaveEventButton = ({ eventId, className }: Props) => {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      const { data } = await supabase
        .from("saved_events")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("event_id", eventId)
        .maybeSingle();
      if (data) setSaved(true);
    };
    check();
  }, [eventId]);

  const toggle = async () => {
    if (!userId) {
      toast.error("Please sign in to save events");
      return;
    }
    setLoading(true);
    if (saved) {
      await supabase.from("saved_events").delete().eq("user_id", userId).eq("event_id", eventId);
      setSaved(false);
      toast.success("Event removed from saved");
    } else {
      await supabase.from("saved_events").insert({ user_id: userId, event_id: eventId });
      setSaved(true);
      toast.success("Event saved!");
    }
    setLoading(false);
  };

  return (
    <Button
      variant="outline"
      onClick={toggle}
      disabled={loading}
      className={`border-border hover:border-primary hover:text-primary ${className || ""}`}
    >
      {saved ? <BookmarkCheck className="mr-2 h-4 w-4 text-primary" /> : <Bookmark className="mr-2 h-4 w-4" />}
      {saved ? "Saved" : "Save Event"}
    </Button>
  );
};

export default SaveEventButton;

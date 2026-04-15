import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Bookmark, Calendar, MapPin, ArrowRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

interface SavedEvent {
  id: string;
  event_id: string;
  created_at: string;
  event?: {
    id: string;
    title: string;
    slug: string;
    date: string;
    location: string;
    image_url: string | null;
    category: string;
  };
}

const SavedEvents = () => {
  const [saved, setSaved] = useState<SavedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { flags } = useFeatureFlags();

  useEffect(() => {
    const fetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);

      const { data: savedData } = await supabase
        .from("saved_events")
        .select("id, event_id, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (!savedData || savedData.length === 0) { setLoading(false); return; }

      // Fetch event details
      const eventIds = savedData.map(s => s.event_id);
      const { data: events } = await supabase
        .from("events")
        .select("id, title, slug, date, location, image_url, category")
        .in("id", eventIds);

      const evMap = Object.fromEntries((events || []).map(e => [e.id, e]));
      setSaved(savedData.map(s => ({ ...s, event: evMap[s.event_id] })));
      setLoading(false);
    };
    fetch();
  }, []);

  const remove = async (savedId: string) => {
    await supabase.from("saved_events").delete().eq("id", savedId);
    setSaved(prev => prev.filter(s => s.id !== savedId));
    toast.success("Event removed from saved");
  };

  if (!flags.feature_save_events) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-foreground">Feature Not Available</h1>
          <Button asChild><Link to="/">Go Home</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Saved Events" description="View and manage your saved events on VERS." path="/saved-events" noindex />
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="flex items-center gap-3 mb-8">
          <Bookmark className="h-6 w-6 text-primary" />
          <h1 className="font-display text-3xl font-bold text-foreground">My Saved Events</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : !userId ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-muted-foreground">Please sign in to view saved events.</p>
            <Button asChild><Link to="/auth">Sign In</Link></Button>
          </div>
        ) : saved.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <Bookmark className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No saved events yet. Browse events and save the ones you like!</p>
            <Button asChild><Link to="/events">Browse Events</Link></Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map(s => s.event && (
              <div key={s.id} className="rounded-xl border border-border bg-card overflow-hidden group">
                {s.event.image_url ? (
                  <img src={s.event.image_url} alt={s.event.title} className="h-40 w-full object-cover" />
                ) : (
                  <div className="h-40 w-full bg-secondary" />
                )}
                <div className="p-4 space-y-3">
                  <span className="text-[10px] font-semibold text-primary uppercase">{s.event.category}</span>
                  <h3 className="font-display text-sm font-bold text-foreground">{s.event.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {s.event.date}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.event.location}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild size="sm" className="flex-1 bg-gradient-gold text-primary-foreground hover:opacity-90">
                      <Link to={`/event/${s.event.slug}`}><ArrowRight className="mr-1 h-3 w-3" /> View & Register</Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => remove(s.id)} className="border-border hover:border-destructive hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default SavedEvents;

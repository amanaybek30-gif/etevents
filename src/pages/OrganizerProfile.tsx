import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Calendar, MapPin, Globe, Mail, ArrowLeft, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import SEO from "@/components/SEO";

interface OrgProfile {
  id: string;
  organization_name: string;
  bio: string | null;
  website: string | null;
  logo_url: string | null;
  city: string | null;
  country: string | null;
  event_categories: string[];
  social_links: Record<string, string>;
  email: string | null;
  user_id: string;
}

interface EventItem {
  id: string;
  title: string;
  slug: string;
  date: string;
  location: string;
  image_url: string | null;
  category: string;
}

const OrganizerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { flags } = useFeatureFlags();

  useEffect(() => {
    const fetch = async () => {
      if (!id) return;
      const { data: prof } = await supabase
        .from("organizer_profiles")
        .select("*")
        .eq("id", id)
        .single();

      if (!prof || !(prof as any).is_profile_public) {
        setLoading(false);
        return;
      }

      const p = prof as any;
      setProfile({
        id: p.id,
        organization_name: p.organization_name,
        bio: p.bio,
        website: p.website,
        logo_url: p.logo_url,
        city: p.city,
        country: p.country,
        event_categories: p.event_categories || [],
        social_links: p.social_links || {},
        email: p.email,
        user_id: p.user_id,
      });

      const { data: evts } = await supabase
        .from("events")
        .select("id, title, slug, date, location, image_url, category")
        .eq("organizer_id", p.user_id)
        .eq("is_published", true)
        .order("date", { ascending: false });

      if (evts) setEvents(evts);
      setLoading(false);
    };
    fetch();
  }, [id]);

  if (!flags.feature_organizer_profiles) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-foreground">Feature Not Available</h1>
          <Button asChild><Link to="/">Go Home</Link></Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <div className="text-center space-y-4">
            <h1 className="font-display text-2xl font-bold text-foreground">Profile Not Found</h1>
            <Button asChild><Link to="/events">Browse Events</Link></Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const upcoming = events.filter(e => e.date >= today);
  const past = events.filter(e => e.date < today);

  const socialLinks = Object.entries(profile.social_links).filter(([, v]) => v);

  return (
    <div className="min-h-screen bg-background">
      <SEO title={profile.organization_name} description={profile.bio?.slice(0, 155) || `${profile.organization_name} — event organizer on VERS`} path={`/organizer/${id}`} image={profile.logo_url || undefined} />
      <Navbar />
      <div className="container mx-auto px-4 py-12">
        <Link to="/events" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Events
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {profile.logo_url ? (
              <img src={profile.logo_url} alt={profile.organization_name} className="h-24 w-24 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border">
                <Users className="h-10 w-10 text-primary" />
              </div>
            )}
            <div className="space-y-2">
              <h1 className="font-display text-3xl font-bold text-foreground">{profile.organization_name}</h1>
              {(profile.city || profile.country) && (
                <p className="flex items-center gap-1 text-muted-foreground text-sm">
                  <MapPin className="h-4 w-4" /> {[profile.city, profile.country].filter(Boolean).join(", ")}
                </p>
              )}
              {profile.event_categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {profile.event_categories.map(cat => (
                    <span key={cat} className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">{cat}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3">
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm flex items-center gap-1">
                    <Globe className="h-4 w-4" /> Website
                  </a>
                )}
                {profile.email && (
                  <a href={`mailto:${profile.email}`} className="text-primary hover:underline text-sm flex items-center gap-1">
                    <Mail className="h-4 w-4" /> Contact
                  </a>
                )}
              </div>
              {socialLinks.length > 0 && (
                <div className="flex gap-3">
                  {socialLinks.map(([platform, url]) => (
                    <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary capitalize">{platform}</a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-3">About</h2>
              <p className="text-muted-foreground leading-relaxed">{profile.bio}</p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="font-display text-2xl font-bold text-foreground">{events.length}</p>
              <p className="text-xs text-muted-foreground">Total Events</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="font-display text-2xl font-bold text-primary">{upcoming.length}</p>
              <p className="text-xs text-muted-foreground">Upcoming</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="font-display text-2xl font-bold text-muted-foreground">{past.length}</p>
              <p className="text-xs text-muted-foreground">Past Events</p>
            </div>
          </div>

          {/* Upcoming Events */}
          {upcoming.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-foreground">Upcoming Events</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map(ev => (
                  <Link key={ev.id} to={`/event/${ev.slug}`} className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary transition-colors">
                    {ev.image_url ? (
                      <img src={ev.image_url} alt={ev.title} className="h-40 w-full object-cover" />
                    ) : (
                      <div className="h-40 w-full bg-secondary" />
                    )}
                    <div className="p-4 space-y-2">
                      <span className="text-[10px] font-semibold text-primary uppercase">{ev.category}</span>
                      <h3 className="font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors">{ev.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {ev.date}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {ev.location}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Past Events */}
          {past.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-bold text-foreground">Past Events</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {past.map(ev => (
                  <Link key={ev.id} to={`/event/${ev.slug}`} className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-colors opacity-75">
                    {ev.image_url ? (
                      <img src={ev.image_url} alt={ev.title} className="h-32 w-full object-cover grayscale" />
                    ) : (
                      <div className="h-32 w-full bg-secondary" />
                    )}
                    <div className="p-3 space-y-1">
                      <h3 className="text-sm font-semibold text-foreground">{ev.title}</h3>
                      <p className="text-xs text-muted-foreground">{ev.date} · {ev.location}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default OrganizerProfile;

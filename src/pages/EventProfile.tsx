import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock, Users, ArrowLeft, CheckCircle, Copy, Store, X, FileText, Play, Download, Image as ImageIcon } from "lucide-react";
import ReportDisputeButton from "@/components/ReportDisputeButton";
import { motion, AnimatePresence } from "framer-motion";
import { sampleEvents } from "@/data/sampleEvents";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import RSVPDialog from "@/components/RSVPDialog";
import SaveEventButton from "@/components/SaveEventButton";
import ShareEventDialog from "@/components/ShareEventDialog";
import EventDiscussion from "@/components/EventDiscussion";
import WaitlistForm from "@/components/WaitlistForm";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type PersonProfile = { name: string; title: string; bio: string; statement?: string; photo_url?: string; role?: string };
type EventMaterial = { id: string; title: string; type: "image" | "video" | "file"; url: string; description?: string; file_name?: string };


const EventProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [preSelectedTier, setPreSelectedTier] = useState<string | undefined>(undefined);
  const [selectedPerson, setSelectedPerson] = useState<PersonProfile | null>(null);
  const sampleEvent = sampleEvents.find((e) => e.slug === slug);
  const { flags } = useFeatureFlags();

  const isSample = !!sampleEvent;
  const { data: dbEvent, isLoading: dbLoading, isFetching: dbFetching } = useQuery({
    queryKey: ["event-db", slug],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("*").eq("slug", slug!).single();
      return data;
    },
    enabled: !!slug && !isSample,
  });

  // Check if event is at capacity (for waitlist)
  const { data: regCount } = useQuery({
    queryKey: ["event-reg-count", dbEvent?.id],
    queryFn: async () => {
      const { count } = await supabase.from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", dbEvent!.id)
        .eq("status", "approved");
      return count || 0;
    },
    enabled: !!dbEvent?.id,
  });

  const isAtCapacity = dbEvent?.expected_attendees && regCount !== undefined && regCount >= dbEvent.expected_attendees;
  const waitlistEnabled = (dbEvent as any)?.waitlist_enabled;

  // Auto-close registration if the event date/time has already passed
  const isEventPast = (() => {
    if (!dbEvent) return false;
    const endDateStr = (dbEvent as any).end_date || dbEvent.date;
    if (!endDateStr) return false;
    // For multi-day events use end_date; for single-day combine with time
    const timeStr = (dbEvent as any).end_date ? "23:59" : (dbEvent.time || "23:59");
    // Extract first time token (handles ranges like "10:00 AM - 4:00 PM" by using the start; fallback safe)
    const cleanTime = String(timeStr).trim().split(/\s*-\s*/)[0] || "23:59";
    let hh = 23, mm = 59;
    const ampmMatch = cleanTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (ampmMatch) {
      hh = parseInt(ampmMatch[1], 10);
      mm = parseInt(ampmMatch[2], 10);
      const ap = ampmMatch[3]?.toUpperCase();
      if (ap === "PM" && hh < 12) hh += 12;
      if (ap === "AM" && hh === 12) hh = 0;
    }
    const eventEnd = new Date(`${endDateStr}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00`);
    if (isNaN(eventEnd.getTime())) return false;
    return eventEnd.getTime() < Date.now();
  })();

  const registrationOpen = (dbEvent as any)?.registration_enabled !== false && !isEventPast;

  // Track event page view with accurate source attribution
  const viewTracked = useRef(false);
  useEffect(() => {
    if (!dbEvent?.id || viewTracked.current) return;
    viewTracked.current = true;
    // Prefer UTM source for accuracy, fall back to document.referrer
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get("utm_source");
    const utmMedium = params.get("utm_medium");
    const utmCampaign = params.get("utm_campaign");
    let referrer = document.referrer || null;
    // If UTM params exist, construct a synthetic referrer for accurate tracking
    if (utmSource) {
      referrer = `https://${utmSource}.com/${utmMedium ? `?medium=${utmMedium}` : ""}${utmCampaign ? `&campaign=${utmCampaign}` : ""}`;
    }
    supabase.from("event_views").insert({ event_id: dbEvent.id, referrer }).then(() => {});
  }, [dbEvent?.id]);

  const shareUrl = `https://vers.vionevents.com/event/${slug}`;
  const copyLink = () => { navigator.clipboard.writeText(shareUrl); toast.success("Event link copied!"); };

  // Sample event profile
  if (sampleEvent) {
    return (
      <div className="min-h-screen bg-background">
        <SEO title={sampleEvent.title} description={sampleEvent.about?.slice(0, 155) || sampleEvent.title} path={`/event/${slug}`} image={sampleEvent.image} />
        <Navbar />
        <div className="relative h-[50vh] min-h-[400px] w-full overflow-hidden">
          <img src={sampleEvent.image} alt={sampleEvent.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
            <div className="container mx-auto">
              <Link to="/events" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back to Events
              </Link>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">{sampleEvent.category}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/80 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-muted-foreground border border-border">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    SAMPLE EVENT
                  </span>
                </div>
                <h1 className="font-display text-4xl font-bold text-foreground md:text-6xl">{sampleEvent.title}</h1>
              </motion.div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          <div className="grid gap-12 lg:grid-cols-3">
            <div className="space-y-10 lg:col-span-2">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { icon: Calendar, label: "Date", value: sampleEvent.date },
                  { icon: MapPin, label: "Location", value: sampleEvent.location.split(",")[0] },
                  { icon: Clock, label: "Duration", value: sampleEvent.duration },
                  { icon: Users, label: "Expected", value: `${sampleEvent.expectedAttendees.toLocaleString()} attendees` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-lg border border-border bg-card p-4">
                    <Icon className="mb-2 h-5 w-5 text-primary" />
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-semibold text-foreground">{value}</p>
                  </div>
                ))}
              </div>
              <section><h2 className="font-display text-2xl font-bold text-foreground">About the Event</h2><p className="mt-4 leading-relaxed text-muted-foreground">{sampleEvent.about}</p></section>
              <section><h2 className="font-display text-2xl font-bold text-foreground">Event Details</h2><p className="mt-4 leading-relaxed text-muted-foreground">{sampleEvent.details}</p></section>
              <section>
                <h2 className="font-display text-2xl font-bold text-foreground">What to Expect</h2>
                <ul className="mt-4 space-y-3">
                  {sampleEvent.whatToExpect.map((item) => (
                    <li key={item} className="flex items-start gap-3"><CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span className="text-muted-foreground">{item}</span></li>
                  ))}
                </ul>
              </section>
              <section>
                <h2 className="font-display text-2xl font-bold text-foreground">Hosted By</h2>
                <p className="mt-2 text-lg font-semibold text-primary">{sampleEvent.host}</p>
                <h3 className="mt-6 font-display text-lg font-semibold text-foreground">Partner Organizations</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sampleEvent.partners.map((p) => <span key={p} className="rounded-full border border-border bg-secondary px-4 py-1.5 text-sm text-secondary-foreground">{p}</span>)}
                </div>
              </section>
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6 rounded-xl border border-border bg-card p-6">
                <div>
                  <p className="text-sm text-muted-foreground">Ticket Price</p>
                  <p className="font-display text-3xl font-bold text-primary">{sampleEvent.ticketPrice}</p>
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-foreground">What's Included</p>
                  <ul className="space-y-2">
                    {sampleEvent.includes.map((item) => <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle className="h-4 w-4 text-primary" /> {item}</li>)}
                  </ul>
                </div>
                <Button onClick={() => setRsvpOpen(true)} className="w-full bg-gradient-gold text-primary-foreground text-lg py-6 hover:opacity-90">Book Now</Button>
                <Button variant="outline" onClick={copyLink} className="w-full border-border hover:border-primary hover:text-primary">
                  <Copy className="mr-2 h-4 w-4" /> Copy Event Link
                </Button>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
                  <p className="text-xs text-muted-foreground">Event starts on</p>
                  <p className="font-display text-lg font-bold text-foreground">{sampleEvent.date}</p>
                  <p className="text-sm text-muted-foreground">at {sampleEvent.time}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {dbEvent && (
          <RSVPDialog open={rsvpOpen} onOpenChange={setRsvpOpen} eventTitle={sampleEvent.title} eventSlug={sampleEvent.slug} eventId={dbEvent.id} ticketPrice={sampleEvent.ticketPrice} />
        )}
        <Footer />
      </div>
    );
  }

  // Loading state for DB events — show spinner while loading OR while query hasn't resolved yet
  if (!isSample && (dbLoading || dbFetching || !dbEvent)) {
    // Only show "not found" if the query has finished and returned nothing
    if (!dbLoading && !dbFetching && !dbEvent) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="font-display text-4xl font-bold text-foreground">Event Not Found</h1>
            <Button asChild className="mt-6 bg-gradient-gold text-primary-foreground"><Link to="/events">Back to Events</Link></Button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading event...</p>
        </div>
      </div>
    );
  }

  if (!dbEvent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold text-foreground">Event Not Found</h1>
          <Button asChild className="mt-6 bg-gradient-gold text-primary-foreground"><Link to="/events">Back to Events</Link></Button>
        </div>
      </div>
    );
  }

  

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={dbEvent?.title || "Event"}
        description={dbEvent?.short_description || dbEvent?.about?.slice(0, 155) || "View event details on VERS"}
        path={`/event/${slug}`}
        image={dbEvent?.image_url || undefined}
        type="article"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Event",
          name: dbEvent?.title,
          description: dbEvent?.short_description || dbEvent?.about?.slice(0, 155),
          startDate: dbEvent?.date,
          ...(dbEvent?.end_date ? { endDate: dbEvent.end_date } : {}),
          location: {
            "@type": "Place",
            name: dbEvent?.location,
          },
          image: dbEvent?.image_url || undefined,
          url: `https://vers.vionevents.com/event/${slug}`,
          organizer: {
            "@type": "Organization",
            name: dbEvent?.host || "VERS",
          },
        }}
      />
      <Navbar />
      <div className="relative h-[50vh] min-h-[400px] w-full overflow-hidden">
        {(dbEvent as any).video_url ? (
          <video
            src={(dbEvent as any).video_url}
            autoPlay loop muted playsInline
            className="h-full w-full object-cover"
          />
        ) : dbEvent.image_url ? (
          <img src={dbEvent.image_url} alt={dbEvent.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-secondary" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <div className="container mx-auto">
            <Link to="/events" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to Events
            </Link>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <span className="mb-2 inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">{dbEvent.category}</span>
              <h1 className="font-display text-4xl font-bold text-foreground md:text-6xl">{dbEvent.title}</h1>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-12 lg:grid-cols-3">
          <div className="space-y-10 lg:col-span-2">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(() => {
              const formatDate = (d: string) => {
                try {
                  const parsed = new Date(d + "T00:00:00");
                  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
                } catch { return d; }
              };
              const endDate = (dbEvent as any).end_date;
              const dateDisplay = endDate ? `${formatDate(dbEvent.date)} - ${formatDate(endDate)}` : dbEvent.date;
              return [
                { icon: Calendar, label: "Date", value: dateDisplay },
                { icon: MapPin, label: "Location", value: dbEvent.location },
                { icon: Clock, label: "Duration", value: dbEvent.duration || "TBD" },
                { icon: Users, label: "Expected", value: dbEvent.expected_attendees ? `${dbEvent.expected_attendees.toLocaleString()} attendees` : "TBD" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-lg border border-border bg-card p-4">
                  <Icon className="mb-2 h-5 w-5 text-primary" />
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-semibold text-foreground">{value}</p>
                </div>
              ));
            })()}
            </div>

            {dbEvent.about && <section><h2 className="font-display text-2xl font-bold text-foreground">About the Event</h2><p className="mt-4 leading-relaxed text-muted-foreground">{dbEvent.about}</p></section>}
            {dbEvent.details && <section><h2 className="font-display text-2xl font-bold text-foreground">Event Details</h2><p className="mt-4 leading-relaxed text-muted-foreground">{dbEvent.details}</p></section>}

            {/* Event Video showcase - shown when video exists and image is used as cover */}
            {(dbEvent as any).video_url && dbEvent.image_url && (
              <section>
                <h2 className="font-display text-2xl font-bold text-foreground">Watch</h2>
                <div className="mt-4 rounded-xl overflow-hidden border border-border">
                  <video
                    src={(dbEvent as any).video_url}
                    controls
                    playsInline
                    className="w-full max-h-[480px] object-contain bg-black"
                    poster={dbEvent.image_url}
                  />
                </div>
              </section>
            )}
            {dbEvent.what_to_expect && dbEvent.what_to_expect.length > 0 && (
              <section>
                <h2 className="font-display text-2xl font-bold text-foreground">What to Expect</h2>
                <ul className="mt-4 space-y-3">
                  {dbEvent.what_to_expect.map((item) => <li key={item} className="flex items-start gap-3"><CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span className="text-muted-foreground">{item}</span></li>)}
                </ul>
              </section>
            )}

            {/* Event Materials - Schedules, Agendas, etc. */}
            {(dbEvent as any).materials && Array.isArray((dbEvent as any).materials) && (dbEvent as any).materials.length > 0 && (() => {
              const materials = (dbEvent as any).materials as EventMaterial[];
              const images = materials.filter(m => m.type === "image");
              const videos = materials.filter(m => m.type === "video");
              const files = materials.filter(m => m.type === "file");

              const CATEGORY_LABELS: Record<string, string> = {
                schedule: "Schedule / Agenda",
                map: "Venue Map / Layout",
                menu: "Menu / Catalog",
                brochure: "Brochure / Flyer",
                highlight: "Highlight Reel",
                gallery: "Gallery / Photos",
                other: "Other",
              };

              return (
                <section className="space-y-6">
                  <h2 className="font-display text-2xl font-bold text-foreground">Event Materials</h2>

                  {/* Image materials - elegant gallery */}
                  {images.length > 0 && (
                    <div className="space-y-4">
                      {images.map((mat, idx) => (
                        <motion.div
                          key={mat.id || idx}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="group relative overflow-hidden rounded-2xl border border-border bg-card"
                        >
                          <div className="relative">
                            <img
                              src={mat.url}
                              alt={mat.title}
                              className="w-full object-contain max-h-[70vh] bg-secondary/20"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6">
                              <div className="flex items-end justify-between">
                                <div>
                                  {mat.description && mat.description !== "other" && (
                                    <span className="inline-block rounded-full bg-primary/90 px-3 py-0.5 text-[10px] font-semibold text-primary-foreground uppercase tracking-wider mb-2">
                                      {CATEGORY_LABELS[mat.description] || mat.description}
                                    </span>
                                  )}
                                  <h3 className="font-display text-lg font-bold text-white">{mat.title}</h3>
                                </div>
                                <a
                                  href={mat.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white hover:bg-white/30 transition-colors"
                                >
                                  <Download className="h-3.5 w-3.5" /> View Full
                                </a>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Video materials */}
                  {videos.length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-1">
                      {videos.map((mat, idx) => (
                        <motion.div
                          key={mat.id || idx}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="overflow-hidden rounded-2xl border border-border bg-card"
                        >
                          {mat.description && mat.description !== "other" && (
                            <div className="px-5 pt-4">
                              <span className="inline-block rounded-full bg-primary/10 px-3 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                                {CATEGORY_LABELS[mat.description] || mat.description}
                              </span>
                            </div>
                          )}
                          <div className="p-4 pb-2">
                            <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                              <Play className="h-4 w-4 text-primary" />
                              {mat.title}
                            </h3>
                          </div>
                          <div className="px-4 pb-4">
                            <video
                              src={mat.url}
                              controls
                              playsInline
                              className="w-full rounded-xl max-h-[480px] object-contain bg-black"
                            />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* File materials - download cards */}
                  {files.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {files.map((mat, idx) => (
                        <motion.a
                          key={mat.id || idx}
                          href={mat.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.08 }}
                          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-lg transition-all duration-300"
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                              {mat.title}
                            </h4>
                            {mat.description && mat.description !== "other" && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {CATEGORY_LABELS[mat.description] || mat.description}
                              </p>
                            )}
                            {mat.file_name && (
                              <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">
                                {mat.file_name}
                              </p>
                            )}
                          </div>
                          <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                        </motion.a>
                      ))}
                    </div>
                  )}
                </section>
              );
            })()}

            {dbEvent.host && (
              <section>
                <h2 className="font-display text-2xl font-bold text-foreground">Hosted By</h2>
                <p className="mt-2 text-lg font-semibold text-primary">{dbEvent.host}</p>
                {dbEvent.partners && dbEvent.partners.length > 0 && (
                  <>
                    <h3 className="mt-6 font-display text-lg font-semibold text-foreground">Partner Organizations</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {dbEvent.partners.map((p) => <span key={p} className="rounded-full border border-border bg-secondary px-4 py-1.5 text-sm text-secondary-foreground">{p}</span>)}
                    </div>
                  </>
                )}
              </section>
            )}

            {/* Speakers, Guests & MC - separated by role */}
            {(dbEvent as any).speakers && Array.isArray((dbEvent as any).speakers) && (dbEvent as any).speakers.length > 0 && (() => {
              const allPeople = (dbEvent as any).speakers as PersonProfile[];
              const mcs = allPeople.filter(p => p.role === "mc");
              const speakersList = allPeople.filter(p => !p.role || p.role === "speaker");
              const guests = allPeople.filter(p => p.role === "guest");

              const renderPersonCard = (person: PersonProfile, idx: number, globalIdx: number) => (
                <motion.div
                  key={globalIdx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  onClick={() => setSelectedPerson(person)}
                  className="group cursor-pointer rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all duration-300"
                >
                  {person.photo_url ? (
                    <div className="relative aspect-square overflow-hidden">
                      <img src={person.photo_url} alt={person.name} className="h-full w-full object-cover bg-secondary/30 transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
                    </div>
                  ) : (
                    <div className="flex h-32 items-center justify-center bg-primary/5">
                      <span className="font-display text-4xl font-bold text-primary/40">{person.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <div className="p-4 space-y-1">
                    <h3 className="font-display text-base font-bold text-foreground group-hover:text-primary transition-colors">{person.name}</h3>
                    {person.title && <p className="text-xs font-medium text-primary">{person.title}</p>}
                    {person.bio && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{person.bio}</p>}
                    <p className="text-[11px] text-primary/60 font-medium pt-1">Tap to view profile →</p>
                  </div>
                </motion.div>
              );

              const getGridCols = (count: number) => {
                if (count <= 3) return "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";
                if (count <= 6) return "grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
                if (count <= 12) return "grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";
                return "grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6";
              };

              const renderSection = (title: string, people: PersonProfile[], startIdx: number) => people.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
                    <span className="h-1 w-6 rounded-full bg-primary inline-block" />
                    {title}
                    <span className="text-sm font-normal text-muted-foreground">({people.length})</span>
                  </h3>
                  <div className={getGridCols(people.length)}>
                    {people.map((p, idx) => renderPersonCard(p, idx, startIdx + idx))}
                  </div>
                </div>
              ) : null;

              return (
                <section className="space-y-8">
                  <h2 className="font-display text-2xl font-bold text-foreground">People</h2>
                  {renderSection("MC / Host", mcs, 0)}
                  {renderSection("Speakers", speakersList, mcs.length)}
                  {renderSection("Special Guests", guests, mcs.length + speakersList.length)}
                </section>
              );
            })()}

            {/* Person Profile Modal */}
            <Dialog open={!!selectedPerson} onOpenChange={(open) => { if (!open) setSelectedPerson(null); }}>
              <DialogContent className="max-w-lg p-0 overflow-hidden max-h-[90vh]">
                {selectedPerson && (
                  <div className="overflow-y-auto max-h-[90vh]">
                    {selectedPerson.photo_url ? (
                      <div className="relative flex items-center justify-center bg-secondary/20 p-4">
                        <img src={selectedPerson.photo_url} alt={selectedPerson.name} className="h-auto max-h-[60vh] w-full object-contain" />
                      </div>
                    ) : (
                      <div className="flex h-32 items-center justify-center bg-primary/5">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary font-display text-3xl font-bold">
                          {selectedPerson.name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    )}
                    <div className="px-6 pt-5 pb-2">
                      <span className="inline-block rounded-full bg-primary/90 px-3 py-0.5 text-[11px] font-semibold text-primary-foreground uppercase tracking-wider mb-2">
                        {selectedPerson.role === "mc" ? "MC / Host" : selectedPerson.role === "guest" ? "Special Guest" : "Speaker"}
                      </span>
                      <h2 className="font-display text-2xl font-bold text-foreground">{selectedPerson.name}</h2>
                      {selectedPerson.title && <p className="text-sm font-medium text-primary mt-0.5">{selectedPerson.title}</p>}
                    </div>
                    <div className="px-6 py-4 space-y-4 pb-8">
                      {selectedPerson.bio && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">About</h4>
                          <p className="text-sm text-foreground leading-relaxed">{selectedPerson.bio}</p>
                        </div>
                      )}
                      {selectedPerson.statement && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Statement</h4>
                          <blockquote className="text-sm italic text-muted-foreground border-l-2 border-primary/40 pl-4 py-1">
                            "{selectedPerson.statement}"
                          </blockquote>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>



            {/* Event Discussion */}
            <EventDiscussion eventId={dbEvent.id} />
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6 rounded-xl border border-border bg-card p-6">
              {/* Show ticket tiers as clickable cards when available, otherwise show general price */}
              {(dbEvent as any).ticket_tiers && Array.isArray((dbEvent as any).ticket_tiers) && (dbEvent as any).ticket_tiers.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">Select Your Ticket</p>
                  <div className="space-y-2">
                    {((dbEvent as any).ticket_tiers as { id: string; name: string; price: string; description: string }[]).map(tier => (
                      <button
                        key={tier.id}
                        type="button"
                        disabled={!registrationOpen}
                        onClick={() => {
                          if (!registrationOpen) return;
                          setPreSelectedTier(tier.id);
                          setRsvpOpen(true);
                        }}
                        className={`w-full text-left rounded-lg border border-border bg-secondary/50 p-4 transition-all duration-200 group ${!registrationOpen ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{tier.name}</span>
                          <span className="text-sm font-bold text-primary">{tier.price}</span>
                        </div>
                        {tier.description && <p className="text-xs text-muted-foreground mt-1">{tier.description}</p>}
                        <p className="text-[11px] text-primary/60 font-medium mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Click to purchase →</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">Ticket Price</p>
                  <p className="font-display text-3xl font-bold text-primary">{!registrationOpen ? "Free" : dbEvent.ticket_price}</p>
                </div>
              )}
              {dbEvent.includes && dbEvent.includes.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-foreground">What's Included</p>
                  <ul className="space-y-2">
                    {dbEvent.includes.map((item) => <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle className="h-4 w-4 text-primary" /> {item}</li>)}
                  </ul>
                </div>
              )}
              {registrationOpen ? (
                isAtCapacity && waitlistEnabled ? (
                  <WaitlistForm eventId={dbEvent.id} eventTitle={dbEvent.title} />
                ) : (
                  /* Only show "Book Now" button if there are no tiers (tiers are clickable above) */
                  !((dbEvent as any).ticket_tiers && Array.isArray((dbEvent as any).ticket_tiers) && (dbEvent as any).ticket_tiers.length > 0) && (
                    <Button onClick={() => setRsvpOpen(true)} className="w-full bg-gradient-gold text-primary-foreground text-lg py-6 hover:opacity-90">
                      Book Now
                    </Button>
                  )
                )
              ) : (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center space-y-1">
                  <p className="text-sm font-semibold text-destructive">Registration Closed</p>
                  <p className="text-xs text-muted-foreground">
                    {isEventPast
                      ? "This event has already ended."
                      : (dbEvent as any).registration_closed_reason === "event_passed"
                      ? "This event date has passed."
                      : (dbEvent as any).registration_closed_reason === "registration_full"
                      ? "Registration is full."
                      : (dbEvent as any).registration_closed_reason === "organizer_closed"
                      ? "Registration has been closed by the organizer."
                      : "Registration is currently closed for this event."}
                  </p>
                </div>
              )}
              <Button variant="outline" onClick={copyLink} className="w-full border-border hover:border-primary hover:text-primary">
                <Copy className="mr-2 h-4 w-4" /> Copy Event Link
              </Button>
              {flags.feature_save_events && (
                <SaveEventButton eventId={dbEvent.id} className="w-full" />
              )}
              {flags.feature_share_events && (
                <ShareEventDialog eventTitle={dbEvent.title} eventUrl={shareUrl} />
              )}
              {flags.feature_vendor_registration && (dbEvent as any).vendor_registration_enabled && (
                <Button asChild variant="outline" className="w-full border-border hover:border-primary hover:text-primary">
                  <Link to={`/event/${dbEvent.slug}/vendor-register`}>
                    <Store className="mr-2 h-4 w-4" /> Vendor Registration
                  </Link>
                </Button>
              )}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
                <p className="text-xs text-muted-foreground">Event starts on</p>
                <p className="font-display text-lg font-bold text-foreground">{dbEvent.date}</p>
                <p className="text-sm text-muted-foreground">at {dbEvent.time}</p>
              </div>
              <div className="text-center pt-2">
                <ReportDisputeButton eventId={dbEvent.id} eventTitle={dbEvent.title} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <RSVPDialog
        open={rsvpOpen}
        onOpenChange={(val) => { setRsvpOpen(val); if (!val) setPreSelectedTier(undefined); }}
        eventTitle={dbEvent.title}
        eventSlug={dbEvent.slug}
        eventId={dbEvent.id}
        ticketPrice={dbEvent.ticket_price}
        acceptedPaymentMethods={(dbEvent as any).accepted_payment_methods || []}
        paymentInfo={(dbEvent as any).payment_info || null}
        paymentInstructions={(dbEvent as any).payment_instructions || null}
        ticketTiers={(dbEvent as any).ticket_tiers || null}
        ticketOnlyMode={!!(dbEvent as any).ticket_only_mode}
        preSelectedTier={preSelectedTier}
        registrationFields={(dbEvent as any).registration_fields || undefined}
      />
      <Footer />
    </div>
  );
};

export default EventProfile;

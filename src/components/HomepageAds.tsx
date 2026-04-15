import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Mail, Phone, Globe, X, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PersonnelItem {
  name: string;
  title: string;
  photo_url: string;
}

interface Ad {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  link_url: string | null;
  event_id: string | null;
  personnel: PersonnelItem[];
  contact_info: { email?: string; phone?: string; website?: string } | null;
}

interface Props {
  advertisements: Ad[];
  events: { id: string; slug: string }[];
  autoAdvanceSeconds?: number;
}

const HomepageAds = ({ advertisements, events, autoAdvanceSeconds = 8 }: Props) => {
  const [current, setCurrent] = useState(0);
  const [contactAd, setContactAd] = useState<Ad | null>(null);

  const next = useCallback(() => setCurrent(i => (i + 1) % (advertisements.length || 1)), [advertisements.length]);
  const prev = () => setCurrent(i => (i - 1 + advertisements.length) % advertisements.length);

  // Auto-advance
  useEffect(() => {
    if (advertisements.length <= 1 || autoAdvanceSeconds <= 0) return;
    const timer = setInterval(next, autoAdvanceSeconds * 1000);
    return () => clearInterval(timer);
  }, [advertisements.length, autoAdvanceSeconds, next]);

  if (!advertisements.length) return null;

  const ad = advertisements[current];
  const eventSlug = ad.event_id ? events.find(e => e.id === ad.event_id)?.slug : null;
  const personnel = (ad.personnel as PersonnelItem[]) || [];

  const handleClick = () => {
    if (eventSlug) return; // Link handles it
    if (ad.link_url) { window.open(ad.link_url, "_blank"); return; }
    setContactAd(ad);
  };

  const Wrapper = eventSlug
    ? ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <Link to={`/event/${eventSlug}`} className={className}>{children}</Link>
      )
    : ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div onClick={handleClick} className={`cursor-pointer ${className}`}>{children}</div>
      );

  return (
    <>
      <section className="relative w-full overflow-hidden bg-card border-b border-border">
        <AnimatePresence mode="wait">
          <motion.div
            key={ad.id}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.5 }}
            className="w-full"
          >
            <Wrapper className="block relative w-full">
              {/* Background image */}
              {(ad.video_url || ad.image_url) ? (
                <div className="relative w-full min-h-[320px] sm:min-h-[400px] md:min-h-[480px]">
                  {ad.video_url ? (
                    <video
                      src={ad.video_url}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <img src={ad.image_url!} alt={ad.title} className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-background/30" />

                  {/* Content overlay */}
                  <div className="relative z-10 flex flex-col justify-end h-full min-h-[320px] sm:min-h-[400px] md:min-h-[480px] p-6 sm:p-10 md:p-16 max-w-4xl">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                      className="space-y-4"
                    >
                      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] bg-primary/20 text-primary px-3 py-1 rounded-full font-bold backdrop-blur-sm border border-primary/20">
                        <Megaphone className="h-3 w-3" /> Sponsored
                      </span>
                      <h2 className="font-display text-2xl sm:text-3xl md:text-5xl font-bold text-foreground leading-tight">{ad.title}</h2>
                      {ad.description && (
                        <p className="text-sm sm:text-base text-muted-foreground max-w-xl line-clamp-3">{ad.description}</p>
                      )}

                      {/* Personnel */}
                      {personnel.length > 0 && (
                        <div className="flex flex-wrap gap-3 pt-2">
                          {personnel.map((p, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.3 + i * 0.1 }}
                              className="flex items-center gap-2 bg-background/60 backdrop-blur-sm rounded-full pl-1 pr-3 py-1 border border-border/50"
                            >
                              {p.photo_url ? (
                                <img src={p.photo_url} alt={p.name} className="h-8 w-8 rounded-full object-cover" />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                                  <span className="text-xs font-bold text-primary">{p.name[0]}</span>
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-semibold text-foreground leading-tight">{p.name}</p>
                                {p.title && <p className="text-[10px] text-muted-foreground leading-tight">{p.title}</p>}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {/* CTA */}
                      <div className="pt-2">
                        {eventSlug ? (
                          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                            View Event Details →
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                            {ad.link_url ? "Learn More →" : "Contact Us →"}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  </div>
                </div>
              ) : (
                /* No image - gradient background */
                <div className="relative w-full min-h-[280px] sm:min-h-[340px] bg-gradient-to-br from-primary/10 via-background to-primary/5">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_hsl(43_100%_50%_/_0.08)_0%,_transparent_60%)]" />
                  <div className="relative z-10 flex flex-col justify-center h-full min-h-[280px] sm:min-h-[340px] p-6 sm:p-10 md:p-16 max-w-4xl">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="space-y-4"
                    >
                      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] bg-primary/20 text-primary px-3 py-1 rounded-full font-bold border border-primary/20">
                        <Megaphone className="h-3 w-3" /> Sponsored
                      </span>
                      <h2 className="font-display text-2xl sm:text-3xl md:text-5xl font-bold text-foreground">{ad.title}</h2>
                      {ad.description && <p className="text-sm sm:text-base text-muted-foreground max-w-xl">{ad.description}</p>}
                      {personnel.length > 0 && (
                        <div className="flex flex-wrap gap-3 pt-2">
                          {personnel.map((p, i) => (
                            <div key={i} className="flex items-center gap-2 bg-card/80 rounded-full pl-1 pr-3 py-1 border border-border/50">
                              {p.photo_url ? (
                                <img src={p.photo_url} alt={p.name} className="h-8 w-8 rounded-full object-cover" />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                                  <span className="text-xs font-bold text-primary">{p.name[0]}</span>
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-semibold text-foreground">{p.name}</p>
                                {p.title && <p className="text-[10px] text-muted-foreground">{p.title}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="pt-2">
                        <span className="text-sm font-semibold text-primary">
                          {eventSlug ? "View Event Details →" : ad.link_url ? "Learn More →" : "Contact Us →"}
                        </span>
                      </div>
                    </motion.div>
                  </div>
                </div>
              )}
            </Wrapper>
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows */}
        {advertisements.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-background/70 backdrop-blur-sm border border-border rounded-full p-2 hover:bg-background transition-colors">
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-background/70 backdrop-blur-sm border border-border rounded-full p-2 hover:bg-background transition-colors">
              <ChevronRight className="h-5 w-5 text-foreground" />
            </button>
            {/* Dots */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {advertisements.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                  className={`h-2 rounded-full transition-all ${i === current ? "w-6 bg-primary" : "w-2 bg-foreground/30"}`}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Contact Popup */}
      <Dialog open={!!contactAd} onOpenChange={() => setContactAd(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Contact Us</DialogTitle>
          </DialogHeader>
          {contactAd?.contact_info && (
            <div className="space-y-4 pt-2">
              {contactAd.contact_info.email && (
                <a href={`mailto:${contactAd.contact_info.email}`} className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors">
                  <Mail className="h-5 w-5 text-primary" />
                  {contactAd.contact_info.email}
                </a>
              )}
              {contactAd.contact_info.phone && (
                <a href={`tel:${contactAd.contact_info.phone}`} className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors">
                  <Phone className="h-5 w-5 text-primary" />
                  {contactAd.contact_info.phone}
                </a>
              )}
              {contactAd.contact_info.website && (
                <a href={contactAd.contact_info.website} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm text-foreground hover:text-primary transition-colors">
                  <Globe className="h-5 w-5 text-primary" />
                  {contactAd.contact_info.website}
                </a>
              )}
            </div>
          )}
          {(!contactAd?.contact_info || (!contactAd.contact_info.email && !contactAd.contact_info.phone && !contactAd.contact_info.website)) && (
            <p className="text-sm text-muted-foreground py-4">No contact information available for this advertisement.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default HomepageAds;

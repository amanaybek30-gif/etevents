import { useState, useEffect, useMemo } from "react";
import SEO from "@/components/SEO";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Sparkles, Calendar, Users, Shield, Star, Quote, Search, Clock, MapPin, TrendingUp, Zap, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import HomepageAds from "@/components/HomepageAds";
import { sampleEvents } from "@/data/sampleEvents";
import EventCard from "@/components/EventCard";
import PublishedEventCard from "@/components/PublishedEventCard";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AnimatedCounter from "@/components/AnimatedCounter";
import CountdownTimer from "@/components/CountdownTimer";
import heroBg from "@/assets/hero-bg.jpg";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const categories = ["All", "Concert", "Conference", "Cultural", "Technology", "Fashion"];
const sampleImageBySlug = new Map(sampleEvents.map((event) => [event.slug, event.image]));

// Rotating hero taglines
const TAGLINES = [
  "Seamless events, every time.",
  "Create. Manage. Experience.",
  "Your next event starts here.",
];

const Index = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [heroTagline, setHeroTagline] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Rotate hero tagline
  useEffect(() => {
    const timer = setInterval(() => setHeroTagline((p) => (p + 1) % TAGLINES.length), 4000);
    return () => clearInterval(timer);
  }, []);

  // Fetch published DB events
  const { data: dbEvents = [] } = useQuery({
    queryKey: ["home-published-events"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("*").eq("is_published", true).order("date", { ascending: true });
      return data || [];
    },
  });

  // Fetch sample events visibility setting
  const { data: showSampleSetting } = useQuery({
    queryKey: ["show-sample-events"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("value").eq("key", "show_sample_events").maybeSingle();
      return data?.value === "true";
    },
  });

  const showSamples = showSampleSetting === true;

  // Fetch testimonials
  const { data: testimonials = [] } = useQuery({
    queryKey: ["home-testimonials"],
    queryFn: async () => {
      const { data } = await supabase.from("testimonials").select("*").eq("is_active", true).order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  // Fetch announcements
  const { data: announcements = [] } = useQuery({
    queryKey: ["home-announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_announcements").select("*").eq("is_active", true).order("priority", { ascending: false }).order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  // Fetch advertisements
  const { data: advertisements = [] } = useQuery({
    queryKey: ["home-advertisements"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_advertisements").select("*").eq("is_active", true).order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  // Fetch ad carousel duration
  const { data: adDuration = 8 } = useQuery({
    queryKey: ["ad-carousel-duration"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("value").eq("key", "ad_carousel_duration").single();
      return data?.value ? parseInt(data.value) : 8;
    },
  });

  // Fetch event slugs for ad linking
  const { data: adEventSlugs = [] } = useQuery({
    queryKey: ["ad-event-slugs"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, slug").eq("is_published", true);
      return data || [];
    },
  });

  // Live stats
  const { data: liveStats } = useQuery({
    queryKey: ["home-live-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_homepage_live_stats");

      if (error) {
        throw error;
      }

      const stats = data?.[0];

      return {
        events: Number(stats?.events_count ?? 0),
        registrations: Number(stats?.registrations_count ?? 0),
        organizers: Number(stats?.organizers_count ?? 0),
      };
    },
    refetchInterval: 30000,
  });

  // Next upcoming event for countdown
  const nextEvent = useMemo(() => {
    const now = new Date().toISOString().split("T")[0];
    return dbEvents.find((e) => e.date >= now);
  }, [dbEvents]);

  const filteredSample = showSamples
    ? (activeCategory === "All" ? sampleEvents : sampleEvents.filter((e) => e.category === activeCategory))
    : [];

  const filteredDb = useMemo(() => {
    let events = activeCategory === "All"
      ? dbEvents
      : dbEvents.filter((e) => e.category === activeCategory || (activeCategory === "Other" && !categories.slice(0, -1).includes(e.category)));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      events = events.filter((e) => e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
    }
    return events;
  }, [dbEvents, activeCategory, searchQuery]);

  // Trending: events with most registrations (simplified — just show first 3 upcoming)
  const trendingEvents = useMemo(() => {
    const now = new Date().toISOString().split("T")[0];
    return dbEvents.filter((e) => e.date >= now).slice(0, 3);
  }, [dbEvents]);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="VERS | Event Registration & Check-In Platform in Ethiopia"
        description="VERS is Ethiopia's all-in-one platform to create, manage, and promote events. Handle registrations, payments, and QR check-ins with ease."
        path="/"
      />
      <Navbar />

      {/* ─── Hero Section ─── */}
      <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden pt-16">
        <img src={heroBg} alt="" className="absolute inset-0 h-full w-full object-cover" aria-hidden="true" />
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(43_100%_50%_/_0.12)_0%,_transparent_70%)]" />

        {/* Floating particles effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-1 w-1 rounded-full bg-primary/30"
              style={{ left: `${15 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
              animate={{
                y: [0, -30, 0],
                opacity: [0.2, 0.6, 0.2],
                scale: [1, 1.5, 1],
              }}
              transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.7 }}
            />
          ))}
        </div>

        <div className="container relative z-10 mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mx-auto max-w-4xl space-y-6 md:space-y-8"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary"
            >
              <Sparkles className="h-4 w-4 animate-pulse" /> Ethiopia's Premier Event Platform
            </motion.div>

            {/* Animated rotating tagline */}
            <div className="h-[80px] md:h-[120px] flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.h1
                  key={heroTagline}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.5 }}
                  className="font-display text-4xl font-bold leading-tight tracking-tight md:text-7xl"
                >
                  {TAGLINES[heroTagline].split(",").map((part, i) =>
                    i === 0 ? (
                      <span key={i}>{part},</span>
                    ) : (
                      <span key={i} className="text-gradient-gold">{part}</span>
                    )
                  )}
                </motion.h1>
              </AnimatePresence>
            </div>

            <p className="mx-auto max-w-2xl text-base md:text-lg text-muted-foreground">
              Easily organize events and manage registrations. Handle check-ins seamlessly across Ethiopia.
            </p>

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="w-full sm:w-auto bg-gradient-gold text-primary-foreground text-lg px-8 hover:opacity-90">
                <Link to="/auth?intent=organizer">
                  Create Your Event <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-lg px-8 border-border hover:border-primary hover:text-primary" onClick={() => document.getElementById("events")?.scrollIntoView({ behavior: "smooth" })}>
                Explore Events
              </Button>
            </div>

          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="h-8 w-5 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-1">
            <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="h-1.5 w-1.5 rounded-full bg-primary" />
          </div>
        </motion.div>
      </section>

      {/* Sponsored Ads - right below hero */}
      <HomepageAds advertisements={advertisements} events={adEventSlugs} autoAdvanceSeconds={adDuration} />

      {/* ─── Live Stats Bar ─── */}
      <section className="border-y border-border bg-card/30">
        <div className="container mx-auto grid grid-cols-3 divide-x divide-border">
          {[
            { label: "Events Hosted", value: liveStats?.events || 0, icon: Calendar, suffix: "+" },
            { label: "Registrations", value: liveStats?.registrations || 0, icon: Users, suffix: "+" },
            { label: "Organizers", value: liveStats?.organizers || 0, icon: TrendingUp, suffix: "+" },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 py-4 sm:py-5 px-2">
              <stat.icon className="h-5 w-5 text-primary" />
              <div className="text-center sm:text-left">
                <AnimatedCounter end={stat.value} suffix={stat.suffix} className="font-display text-lg sm:text-2xl font-bold text-foreground" />
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features Section ─── */}
      <section className="relative border-b border-border bg-card/50 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_hsl(var(--primary)_/_0.06)_0%,_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_hsl(var(--primary)_/_0.04)_0%,_transparent_50%)]" />
        <div className="container relative mx-auto grid grid-cols-2 gap-6 px-4 py-14 sm:grid-cols-4">
          {[
            { label: "Easy Registration", desc: "Seamless sign-up in seconds", icon: Users, detail: "Multiple payment methods, custom forms, instant tickets" },
            { label: "Smart Check-In", desc: "QR-powered instant entry", icon: Zap, detail: "Multi-device support, duplicate prevention, live stats" },
            { label: "Secure Payments", desc: "Safe & verified transactions", icon: Shield, detail: "CBE, Telebirr, M-Pesa and more" },
            { label: "Organizer Control", desc: "Full dashboard at your fingertips", icon: Sparkles, detail: "Analytics, CRM, surveys, promotions" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group relative text-center rounded-2xl border border-border/50 bg-background/60 backdrop-blur-sm p-6 transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_30px_-10px_hsl(var(--primary)_/_0.3)] cursor-default"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/20 group-hover:rotate-3">
                <stat.icon className="h-7 w-7" />
              </div>
              <p className="font-display text-base font-bold text-foreground sm:text-lg">{stat.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.desc}</p>
              {/* Expandable detail on hover */}
              <div className="overflow-hidden max-h-0 group-hover:max-h-20 transition-all duration-300">
                <p className="mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground leading-relaxed">{stat.detail}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Trending Events ─── */}
      {trendingEvents.length > 0 && (
        <section className="py-12 border-b border-border">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-bold text-foreground">Trending Now</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
              {trendingEvents.map((event, i) => {
                const imageSrc = event.image_url || sampleImageBySlug.get(event.slug);
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="snap-start shrink-0 w-[280px] sm:w-[320px]"
                  >
                    <Link to={`/event/${event.slug}`} className="group block rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-all hover:shadow-gold">
                      <div className="relative h-36 overflow-hidden">
                        {imageSrc ? (
                          <img src={imageSrc} alt={event.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                        ) : (
                          <div className="h-full bg-secondary flex items-center justify-center"><Calendar className="h-8 w-8 text-muted-foreground" /></div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                        <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">{event.category}</span>
                      </div>
                      <div className="p-3 space-y-2">
                        <h3 className="font-display text-sm font-bold text-foreground line-clamp-1">{event.title}</h3>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-primary" /> {event.date}</span>
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" /> {event.location.split(",")[0]}</span>
                        </div>
                        <CountdownTimer targetDate={event.date} />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── Featured Events with Search ─── */}
      <section id="events" className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-8 text-center"
          >
            <h2 className="font-display text-4xl font-bold text-foreground md:text-5xl">
              Featured <span className="text-gradient-gold">Events</span>
            </h2>
            <p className="mt-4 text-muted-foreground">Discover the most exciting upcoming events in Ethiopia</p>
          </motion.div>

          {/* Search + Category Filters */}
          <div className="mb-8 space-y-4">
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events by name, location, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card border-border focus:border-primary"
              />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {categories.map((cat) => (
                <motion.button
                  key={cat}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-full border px-4 py-2 text-sm transition-all ${
                    activeCategory === cat
                      ? "border-primary bg-primary/10 text-primary shadow-[0_0_12px_-3px_hsl(var(--primary)_/_0.3)]"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                  }`}
                >
                  {cat}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Results count */}
          {searchQuery && (
            <p className="text-center text-sm text-muted-foreground mb-6">
              {filteredDb.length + filteredSample.length} event{filteredDb.length + filteredSample.length !== 1 ? "s" : ""} found
            </p>
          )}

          {/* Sample Events */}
          {filteredSample.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
              {filteredSample.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          )}

          {/* DB Events */}
          <AnimatePresence mode="popLayout">
            {filteredDb.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
                {filteredDb.map((event, i) => (
                  <PublishedEventCard
                    key={event.id}
                    event={event}
                    index={i}
                    fallbackImage={sampleImageBySlug.get(event.slug)}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>

          {filteredSample.length === 0 && filteredDb.length === 0 && (
            <div className="py-16 text-center space-y-3">
              <Search className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground">No events found{searchQuery ? ` for "${searchQuery}"` : " in this category"}.</p>
              {searchQuery && (
                <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setActiveCategory("All"); }} className="text-primary">
                  Clear search
                </Button>
              )}
            </div>
          )}

          {/* View all link */}
          {(filteredDb.length > 0 || filteredSample.length > 0) && (
            <div className="mt-10 text-center">
              <Button asChild variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
                <Link to="/events">
                  View All Events <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ─── Why VERS ─── */}
      <section className="border-y border-border bg-card/30 py-20 overflow-hidden">
        <div className="container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center font-display text-4xl font-bold text-foreground md:text-5xl"
          >
            Why <span className="text-gradient-gold">VERS</span>?
          </motion.h2>
          <div className="grid grid-cols-2 gap-4 sm:gap-8 md:grid-cols-3">
            {[
              {
                title: "Seamless Event Creation",
                description: "Create stunning event pages in minutes with our intuitive wizard. Set ticket types, customize registration forms, and publish instantly.",
                icon: "🚀",
                stats: "Setup in under 5 minutes",
              },
              {
                title: "Secure Payments",
                description: "Support for all Ethiopian payment methods — CBE, Telebirr, Mpessa, and more. Every transaction is verified and secured.",
                icon: "🔒",
                stats: "Multiple payment methods",
              },
              {
                title: "Smart Check-in",
                description: "QR code-powered check-in system with real-time analytics. Track attendance, prevent duplicates, and export data effortlessly.",
                icon: "📱",
                stats: "Real-time tracking",
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30, rotateY: -10 }}
                whileInView={{ opacity: 1, y: 0, rotateY: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="rounded-xl border border-border bg-card p-8 text-center transition-all hover:border-primary/40 hover:shadow-gold group cursor-default"
              >
                <motion.span
                  className="text-4xl block"
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {feature.icon}
                </motion.span>
                <h3 className="mt-4 font-display text-xl font-bold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                <p className="mt-3 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">{feature.stats}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Announcements ─── */}
      {announcements.length > 0 && (
        <section className="py-12 border-b border-border bg-card/30">
          <div className="container mx-auto px-4 space-y-4">
            {announcements.map((a: any) => (
              <motion.div key={a.id} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-background p-6 flex items-start gap-4 hover:border-primary/40 transition-all">
                {a.image_url && <img src={a.image_url} alt="" className="h-20 w-20 rounded-xl object-cover shrink-0" />}
                <div className="flex-1">
                  <h3 className="font-display text-lg font-bold text-foreground">{a.title}</h3>
                  {a.message && <p className="text-sm text-muted-foreground mt-1">{a.message}</p>}
                  {a.link_url && <a href={a.link_url} className="text-sm text-primary hover:underline mt-2 inline-flex items-center gap-1">{a.link_text || "Learn more"} <ArrowRight className="h-3 w-3" /></a>}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ─── CTA Banner ─── */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-primary/5 p-12 text-center md:p-20 relative"
          >
            {/* Animated background glow */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-[conic-gradient(from_0deg,_transparent,_hsl(var(--primary)_/_0.05),_transparent,_hsl(var(--primary)_/_0.08),_transparent)] pointer-events-none"
            />
            <div className="relative z-10">
              <h2 className="font-display text-4xl font-bold text-foreground md:text-5xl">
                Ready to Host Your <span className="text-gradient-gold">Next Event</span>?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Join hundreds of organizers who trust VERS to deliver exceptional event experiences across Ethiopia.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
                <Button asChild size="lg" className="bg-gradient-gold text-primary-foreground text-lg px-10 hover:opacity-90">
                  <Link to="/auth?intent=organizer">
                    Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-border hover:border-primary">
                  <Link to="/about">Learn More</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      {testimonials.length > 0 && (
        <section className="py-20 border-t border-border">
          <div className="container mx-auto px-4">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-12 text-center">
              <h2 className="font-display text-4xl font-bold text-foreground md:text-5xl">
                What People <span className="text-gradient-gold">Say</span>
              </h2>
              <p className="mt-4 text-muted-foreground">Hear from organizers and attendees who use VERS</p>
            </motion.div>
            <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
              {testimonials.map((t: any, i: number) => (
                <motion.div key={t.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -4 }}
                  className="rounded-xl border border-border bg-card p-6 space-y-4 hover:border-primary/30 transition-all">
                  <Quote className="h-8 w-8 text-primary/30" />
                  <p className="text-sm text-muted-foreground italic leading-relaxed">"{t.quote}"</p>
                  <div className="flex items-center gap-3 pt-2 border-t border-border">
                    {t.avatar_url ? (
                      <img src={t.avatar_url} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{t.name[0]}</span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      {(t.role || t.organization) && <p className="text-xs text-muted-foreground">{[t.role, t.organization].filter(Boolean).join(" · ")}</p>}
                    </div>
                    <div className="ml-auto flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star key={j} className={`h-3.5 w-3.5 ${j < t.rating ? "text-primary fill-primary" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
};

export default Index;

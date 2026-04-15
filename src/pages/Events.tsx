import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { sampleEvents } from "@/data/sampleEvents";
import EventCard from "@/components/EventCard";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CountdownTimer from "@/components/CountdownTimer";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, MapPin, Users, Search, ArrowRight, SlidersHorizontal, X, Clock, TrendingUp } from "lucide-react";

const categories = ["All", "Concert", "Conference", "Cultural", "Technology", "Fashion", "Business", "Other"];
const sampleImageBySlug = new Map(sampleEvents.map((event) => [event.slug, event.image]));

const Events = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date_asc");
  const [priceFilter, setPriceFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const { data: dbEvents = [], isLoading } = useQuery({
    queryKey: ["all-published-events"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("*").eq("is_published", true).order("date", { ascending: true });
      return data || [];
    },
  });

  const { data: showSampleSetting } = useQuery({
    queryKey: ["show-sample-events"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("value").eq("key", "show_sample_events").maybeSingle();
      return data?.value === "true";
    },
  });

  const showSamples = showSampleSetting === true;

  const filteredSample = useMemo(() => {
    if (!showSamples) return [];
    let events = activeCategory === "All" ? sampleEvents : sampleEvents.filter((e) => e.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      events = events.filter((e) => e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q));
    }
    return events;
  }, [showSamples, activeCategory, searchQuery]);

  const filteredDb = useMemo(() => {
    let events = activeCategory === "All"
      ? dbEvents
      : dbEvents.filter((e) => e.category === activeCategory || (activeCategory === "Other" && !categories.slice(0, -1).includes(e.category)));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      events = events.filter((e) =>
        e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
      );
    }

    if (priceFilter === "free") events = events.filter((e) => e.ticket_price === "Free" || e.ticket_price === "0");
    else if (priceFilter === "paid") events = events.filter((e) => e.ticket_price !== "Free" && e.ticket_price !== "0");

    if (sortBy === "date_desc") events = [...events].sort((a, b) => b.date.localeCompare(a.date));
    else if (sortBy === "name") events = [...events].sort((a, b) => a.title.localeCompare(b.title));

    return events;
  }, [dbEvents, activeCategory, searchQuery, priceFilter, sortBy]);

  // Upcoming events with countdowns
  const upcomingEvents = useMemo(() => {
    const now = new Date().toISOString().split("T")[0];
    return dbEvents.filter((e) => e.date >= now).slice(0, 3);
  }, [dbEvents]);

  const totalResults = filteredDb.length + filteredSample.length;
  const hasActiveFilters = searchQuery || activeCategory !== "All" || priceFilter !== "all" || sortBy !== "date_asc";

  const clearFilters = () => {
    setSearchQuery("");
    setActiveCategory("All");
    setPriceFilter("all");
    setSortBy("date_asc");
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Events" description="Discover the most exciting upcoming events in Ethiopia. Browse concerts, conferences, cultural events and more." path="/events" />
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
          <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl">
            Discover <span className="text-gradient-gold">Events</span>
          </h1>
          <p className="mt-4 text-muted-foreground">Find and explore the most exciting upcoming events in Ethiopia</p>
        </motion.div>

        {/* ─── Search & Filters ─── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8 space-y-4">
          <div className="flex gap-2 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, location, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card border-border focus:border-primary h-11"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              className={`border-border h-11 ${showFilters ? "border-primary text-primary" : ""}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" /> Filters
            </Button>
          </div>

          {/* Expandable filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden max-w-2xl mx-auto"
              >
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Sort by</p>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="bg-card border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date_asc">Date (Soonest)</SelectItem>
                        <SelectItem value="date_desc">Date (Latest)</SelectItem>
                        <SelectItem value="name">Name (A-Z)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Price</p>
                    <Select value={priceFilter} onValueChange={setPriceFilter}>
                      <SelectTrigger className="bg-card border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Prices</SelectItem>
                        <SelectItem value="free">Free Only</SelectItem>
                        <SelectItem value="paid">Paid Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Category pills */}
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

          {/* Active filters summary */}
          {hasActiveFilters && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-muted-foreground">{totalResults} result{totalResults !== 1 ? "s" : ""}</span>
              <button onClick={clearFilters} className="text-primary hover:underline text-xs flex items-center gap-1">
                <X className="h-3 w-3" /> Clear all
              </button>
            </div>
          )}
        </motion.div>

        {/* ─── Upcoming Countdowns ─── */}
        {upcomingEvents.length > 0 && !searchQuery && activeCategory === "All" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-10"
          >
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Coming Up Next</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {upcomingEvents.map((event) => (
                <Link key={event.id} to={`/event/${event.slug}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/50 transition-all group">
                  <div className="shrink-0">
                    <CountdownTimer targetDate={event.date} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{event.title}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin className="h-2.5 w-2.5" /> {event.location.split(",")[0]}</p>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── Loading skeleton ─── */}
        {isLoading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
                <div className="aspect-[16/10] bg-secondary" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-secondary rounded w-3/4" />
                  <div className="h-3 bg-secondary rounded w-full" />
                  <div className="h-3 bg-secondary rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sample Events */}
        {filteredSample.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSample.map((event, i) => (
              <EventCard key={event.id} event={event} index={i} />
            ))}
          </div>
        )}

        {/* DB Events */}
        <AnimatePresence mode="popLayout">
          {filteredDb.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDb.map((event, i) => {
                const imageSrc = event.image_url || sampleImageBySlug.get(event.slug);
                const isPostponed = !!(event as any).is_postponed;

                return (
                  <motion.div
                    key={event.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
                  >
                    <Link
                      to={`/event/${event.slug}`}
                      className="group block overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-primary/50 hover:shadow-gold"
                    >
                      {imageSrc && (
                        <div className="relative aspect-[16/10] overflow-hidden">
                          <img src={imageSrc} alt={event.title} className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 ${isPostponed ? "blur-[2px] brightness-50" : ""}`} loading="lazy" />
                          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
                          <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">{event.category}</span>
                          {isPostponed && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="rounded-lg bg-yellow-500/90 px-6 py-2 text-lg font-display font-bold text-background uppercase tracking-wider -rotate-12 shadow-lg">Postponed</span>
                            </div>
                          )}
                          <div className="absolute bottom-3 left-3 right-3">
                            <h3 className="font-display text-xl font-bold text-foreground">{event.title}</h3>
                          </div>
                        </div>
                      )}
                      {!imageSrc && (
                        <div className={`relative aspect-[16/10] overflow-hidden bg-secondary flex items-center justify-center ${isPostponed ? "brightness-50" : ""}`}>
                          <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">{event.category}</span>
                          {isPostponed && (
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                              <span className="rounded-lg bg-yellow-500/90 px-6 py-2 text-lg font-display font-bold text-background uppercase tracking-wider -rotate-12 shadow-lg">Postponed</span>
                            </div>
                          )}
                          <h3 className="font-display text-xl font-bold text-foreground px-4 text-center">{event.title}</h3>
                        </div>
                      )}
                      <div className="space-y-3 p-4">
                        <p className="line-clamp-2 text-sm text-muted-foreground">{event.short_description || "Exciting event coming soon!"}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-primary" /> {event.date}</span>
                          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-primary" /> {event.location}</span>
                          {event.expected_attendees && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-primary" /> {event.expected_attendees.toLocaleString()}</span>}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <span className="text-sm font-semibold text-primary">{event.ticket_price}</span>
                          <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                            View Details <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>

        {!isLoading && filteredSample.length === 0 && filteredDb.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <Search className="mx-auto h-12 w-12 text-muted-foreground/20" />
            <p className="text-lg text-muted-foreground">No events found{searchQuery ? ` for "${searchQuery}"` : ""}.</p>
            <p className="text-sm text-muted-foreground/70">Try adjusting your filters or search terms.</p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="text-primary border-primary/30">
                <X className="h-3 w-3 mr-1" /> Clear all filters
              </Button>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Events;

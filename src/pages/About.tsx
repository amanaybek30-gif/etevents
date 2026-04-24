import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { motion } from "framer-motion";
import { Calendar, Users, Shield, Zap, BarChart3, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import aboutHeroBg from "@/assets/about-hero-bg.jpg";

const features = [
  { icon: Calendar, title: "Event Creation", desc: "Create and publish events in minutes with our intuitive dashboard." },
  { icon: Users, title: "Attendee Management", desc: "Manage registrations, check-ins, and attendee data seamlessly." },
  { icon: Shield, title: "Secure Check-In", desc: "QR-code based check-in system for fast, contactless entry." },
  { icon: Zap, title: "Real-Time Analytics", desc: "Track performance, attendance rates, and engagement metrics live." },
  { icon: BarChart3, title: "CRM & Insights", desc: "Built-in CRM to understand your audience and grow your community." },
  { icon: Globe, title: "Made for Ethiopia", desc: "Designed specifically for the Ethiopian event ecosystem." },
];

const About = () => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "about_vion_video_url")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setVideoUrl(data.value);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="About Us"
        description="Learn about VERS — Ethiopia's smart event registration, check-in, and management platform by VION Events."
        path="/about"
      />
      <Navbar />

      {/* Hero with background image */}
      <div className="relative overflow-hidden">
        <img
          src={aboutHeroBg}
          alt="Event scene"
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-background/75 backdrop-blur-[2px]" />
        <div className="relative container mx-auto px-4 pt-32 pb-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground">
              About <span className="text-gradient-gold">VERS</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              VERS is Ethiopia's all-in-one event registration and check-in platform. Built by VION Events, 
              we help organizers create seamless experiences from registration to post-event analytics.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-4xl space-y-16">

          <div className="space-y-6">
            <h2 className="font-display text-2xl font-bold text-foreground text-center">Our Mission</h2>
            <p className="text-muted-foreground text-center max-w-2xl mx-auto">
              To simplify event management in Ethiopia by providing a modern, reliable, and intelligent platform 
              that empowers organizers to focus on what matters — creating memorable experiences.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-foreground text-center mb-8">What We Offer</h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
              {features.map((f) => (
                <motion.div key={f.title} whileHover={{ y: -4 }} className="rounded-xl border border-border bg-card p-6 space-y-3">
                  <f.icon className="h-8 w-8 text-primary" />
                  <h3 className="font-display text-lg font-semibold text-foreground">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="relative rounded-xl overflow-hidden min-h-[280px]">
            {videoUrl && (
              <video
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                className="absolute inset-0 w-full h-full object-cover"
                key={videoUrl}
              >
                <source src={videoUrl} type="video/mp4" />
              </video>
            )}
            <div className="absolute inset-0 bg-background/30" />
            <div className="relative p-8 text-center space-y-4">
              <h2 className="font-display text-2xl font-bold text-foreground drop-shadow-lg">Built by VION Events</h2>
              <p className="text-muted-foreground max-w-xl mx-auto drop-shadow-md">
                VION Events is an Ethiopian full event service company dedicated to transforming how events are organized and experienced across the country.
              </p>
              <a
                href="https://vionevents.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Visit VION Events <Globe className="h-4 w-4" />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default About;

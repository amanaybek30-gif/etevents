import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VendorRegistrationForm from "@/components/VendorRegistrationForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import SEO from "@/components/SEO";

const VendorRegister = () => {
  const { slug } = useParams<{ slug: string }>();
  const { flags } = useFeatureFlags();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event-vendor", slug],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, title, slug, vendor_registration_enabled, vendor_pricing").eq("slug", slug!).single();
      return data as any;
    },
    enabled: !!slug,
  });

  if (!flags.feature_vendor_registration) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-foreground">Feature Not Available</h1>
          <Button asChild><Link to="/">Go Home</Link></Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!event || !event.vendor_registration_enabled) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-24 pb-16">
          <div className="text-center space-y-4">
            <h1 className="font-display text-2xl font-bold text-foreground">Vendor Registration Not Available</h1>
            <p className="text-muted-foreground">This event is not accepting vendor applications.</p>
            <Button asChild><Link to={`/event/${slug}`}>Back to Event</Link></Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <SEO title={`Vendor Registration – ${event.title}`} description={`Apply as a vendor for ${event.title}`} path={`/event/${slug}/vendor-register`} noindex />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <Link to={`/event/${slug}`} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Event
        </Link>
        <VendorRegistrationForm eventId={event.id} eventTitle={event.title} vendorPricing={event.vendor_pricing} />
      </div>
      <Footer />
    </div>
  );
};

export default VendorRegister;

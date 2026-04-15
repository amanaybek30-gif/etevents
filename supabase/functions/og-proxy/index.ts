import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE = "https://vers.vionevents.com";
const DEFAULT_TITLE = "VERS | Event Registration & Check-In Platform in Ethiopia";
const DEFAULT_DESC = "VERS is Ethiopia's all-in-one platform to create, manage, and promote events. Handle registrations, payments, and QR check-ins with ease.";
const DEFAULT_IMAGE = `${BASE}/Screenshot_2026-03-21_133951.png`;

// Static page meta data
const STATIC_PAGES: Record<string, { title: string; description: string; image?: string }> = {
  "/": { title: DEFAULT_TITLE, description: DEFAULT_DESC },
  "/events": { title: "Browse Events | VERS", description: "Discover and register for upcoming events in Ethiopia. Find conferences, workshops, networking events, and more on VERS." },
  "/about": { title: "About Us | VERS", description: "Learn about VERS — Ethiopia's smart event registration, check-in, and management platform by VION Events." },
  "/help": { title: "Help Center | VERS", description: "Need help with VERS? Find support contacts, FAQs, and assistance for event registration and management." },
  "/privacy": { title: "Privacy Policy | VERS", description: "Read the VERS privacy policy to understand how we collect, use, and protect your personal information." },
  "/terms": { title: "Terms of Service | VERS", description: "Read the VERS terms of service governing the use of our event registration and management platform." },
  "/auth": { title: "Sign In | VERS", description: "Sign in to VERS to manage your events, registrations, and attendee data." },
  "/organizer-auth": { title: "Organizer Login | VERS", description: "Sign in as an event organizer to create and manage events on VERS." },
  "/attendee-auth": { title: "Attendee Login | VERS", description: "Sign in as an attendee to view your registered events and tickets on VERS." },
  "/saved-events": { title: "Saved Events | VERS", description: "View your saved and bookmarked events on VERS." },
  "/my-account": { title: "My Account | VERS", description: "Manage your VERS account, profile, and event history." },
  "/confirm-attendance": { title: "Confirm Attendance | VERS", description: "Confirm your attendance for an upcoming event on VERS." },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.searchParams.get("path") || "/";

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESC;
  let image = DEFAULT_IMAGE;
  let ogType = "website";
  let canonicalUrl = `${BASE}${path}`;
  let jsonLd = "";

  // Check static pages first
  const staticMeta = STATIC_PAGES[path];
  if (staticMeta) {
    title = staticMeta.title;
    description = staticMeta.description;
    if (staticMeta.image) image = staticMeta.image;
  }
  // Dynamic: event pages
  else if (path.startsWith("/event/")) {
    const slug = path.replace("/event/", "").split("?")[0];
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: event } = await supabase
      .from("events")
      .select("title, short_description, about, image_url, date, end_date, time, location, host, ticket_price")
      .eq("slug", slug)
      .single();

    if (event) {
      title = `${event.title} | VERS`;
      description = event.short_description || event.about?.substring(0, 155) || `Register for ${event.title} on VERS.`;
      if (event.image_url) image = event.image_url;
      ogType = "article";

      const dateStr = event.end_date
        ? `${event.date} to ${event.end_date}`
        : event.date;

      jsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.title,
        startDate: event.date,
        ...(event.end_date ? { endDate: event.end_date } : {}),
        location: { "@type": "Place", name: event.location },
        description: description,
        image: image,
        url: canonicalUrl,
        ...(event.host ? { organizer: { "@type": "Organization", name: event.host } } : {}),
        ...(event.ticket_price && event.ticket_price !== "Free"
          ? { offers: { "@type": "Offer", price: event.ticket_price, priceCurrency: "ETB" } }
          : {}),
      });
    }
  }
  // Dynamic: organizer profiles
  else if (path.startsWith("/organizer/")) {
    const id = path.replace("/organizer/", "").split("?")[0];
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: org } = await supabase
      .from("organizer_profiles")
      .select("organization_name, bio, logo_url, city, country")
      .eq("id", id)
      .eq("is_profile_public", true)
      .single();

    if (org) {
      title = `${org.organization_name} | VERS`;
      description = org.bio?.substring(0, 155) || `View events by ${org.organization_name} on VERS.`;
      if (org.logo_url) image = org.logo_url;
    }
  }

  // Escape HTML entities
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonicalUrl)}">

<!-- Open Graph -->
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(canonicalUrl)}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="VERS">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">

${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ""}

<!-- Redirect real users to the actual page -->
<meta http-equiv="refresh" content="0;url=${esc(canonicalUrl)}">
</head>
<body>
<p>Redirecting to <a href="${esc(canonicalUrl)}">${esc(title)}</a>...</p>
</body>
</html>`;

  return new Response(html, {
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
});

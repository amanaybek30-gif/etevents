import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const BASE = "https://vers.vionevents.com";

  // Static pages
  const staticPages = [
    { loc: "/", changefreq: "daily", priority: "1.0" },
    { loc: "/events", changefreq: "daily", priority: "0.9" },
    { loc: "/about", changefreq: "monthly", priority: "0.8" },
    { loc: "/help", changefreq: "monthly", priority: "0.7" },
    { loc: "/saved-events", changefreq: "daily", priority: "0.6" },
    { loc: "/auth", changefreq: "monthly", priority: "0.6" },
    { loc: "/organizer-auth", changefreq: "monthly", priority: "0.6" },
    { loc: "/attendee-auth", changefreq: "monthly", priority: "0.6" },
    { loc: "/my-account", changefreq: "monthly", priority: "0.5" },
    { loc: "/privacy", changefreq: "yearly", priority: "0.5" },
    { loc: "/terms", changefreq: "yearly", priority: "0.5" },
    { loc: "/confirm-attendance", changefreq: "monthly", priority: "0.4" },
  ];

  // Fetch published events
  const { data: events } = await supabase
    .from("events")
    .select("slug, updated_at")
    .eq("is_published", true)
    .order("date", { ascending: false });

  // Fetch public organizer profiles
  const { data: organizers } = await supabase
    .from("organizer_profiles")
    .select("id, updated_at")
    .eq("is_profile_public", true);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const p of staticPages) {
    xml += `  <url><loc>${BASE}${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>\n`;
  }

  if (events) {
    for (const e of events) {
      const lastmod = e.updated_at ? e.updated_at.split("T")[0] : "";
      xml += `  <url><loc>${BASE}/event/${e.slug}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    }
  }

  if (organizers) {
    for (const o of organizers) {
      const lastmod = o.updated_at ? o.updated_at.split("T")[0] : "";
      xml += `  <url><loc>${BASE}/organizer/${o.id}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
    }
  }

  xml += `</urlset>`;

  return new Response(xml, {
    headers: { ...corsHeaders, "Content-Type": "application/xml" },
  });
});

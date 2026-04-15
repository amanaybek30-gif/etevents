import { next } from "@vercel/edge";

const BOT_PATTERNS = [
  "facebookexternalhit", "facebot", "twitterbot", "linkedinbot",
  "whatsapp", "telegrambot", "slackbot", "discordbot", "googlebot",
  "bingbot", "baiduspider", "yandexbot", "applebot", "pinterest",
  "slurp", "duckduckbot", "redditbot", "embedly", "quora link preview",
  "vkshare", "w3c_validator", "mediapartners-google", "adsbot-google",
  "ia_archiver", "outbrain", "showyoubot", "sogou", "exabot",
  "mj12bot", "ahrefsbot", "semrushbot", "dotbot", "petalbot",
];

export default function middleware(request: Request) {
  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  const isBot = BOT_PATTERNS.some((p) => ua.includes(p));

  if (!isBot) {
    return next();
  }

  // Bot detected — proxy to OG edge function
  const url = new URL(request.url);
  const ogUrl = `https://vrnhswdfplkirmyfxpat.supabase.co/functions/v1/og-proxy?path=${encodeURIComponent(url.pathname)}`;

  return fetch(ogUrl);
}

export const config = {
  matcher: [
    "/event/:path*",
    "/organizer/:path*",
    "/events",
    "/about",
    "/help",
    "/privacy",
    "/terms",
    "/auth",
    "/organizer-auth",
    "/attendee-auth",
    "/saved-events",
    "/my-account",
    "/confirm-attendance",
    "/",
  ],
};

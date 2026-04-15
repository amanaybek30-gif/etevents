import addisMusicFest from "@/assets/events/addis-music-fest.jpg";
import ethiopianBusinessSummit from "@/assets/events/ethiopian-business-summit.jpg";
import timkatFestival from "@/assets/events/timkat-festival.jpg";
import addisTechWeek from "@/assets/events/addis-tech-week.jpg";
import coffeeFestival from "@/assets/events/coffee-festival.jpg";
import fashionGala from "@/assets/events/fashion-gala.jpg";

export interface SampleEvent {
  id: string;
  slug: string;
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
  duration: string;
  expectedAttendees: number;
  ticketPrice: string;
  image: string;
  shortDescription: string;
  about: string;
  details: string;
  whatToExpect: string[];
  host: string;
  partners: string[];
  includes: string[];
}

export const sampleEvents: SampleEvent[] = [
  {
    id: "1",
    slug: "addis-music-fest-2026",
    title: "Addis Music Fest 2026",
    category: "Concert",
    date: "March 15, 2026",
    time: "6:00 PM",
    location: "Millennium Hall, Addis Ababa",
    duration: "6 Hours",
    expectedAttendees: 5000,
    ticketPrice: "1,500 ETB",
    image: addisMusicFest,
    shortDescription: "Ethiopia's biggest music celebration featuring top artists from across the nation.",
    about: "Addis Music Fest is the premier annual music festival in Ethiopia, bringing together the nation's most celebrated artists and emerging talents for an unforgettable night of Ethiopian music spanning Ethio-jazz, Amharic pop, traditional folk, and modern Afrobeats fusion.",
    details: "Experience six hours of non-stop live performances across two stages, featuring over 20 artists including headliners from Ethiopia's golden era of music alongside today's chart-topping sensations. The festival grounds will feature Ethiopian food stalls, craft beer gardens, and an artisan marketplace.",
    whatToExpect: [
      "Live performances by 20+ Ethiopian artists",
      "Ethio-jazz, Amharic pop & Afrobeats stages",
      "Traditional Ethiopian food court",
      "Artisan craft marketplace",
      "VIP lounge with exclusive meet & greet"
    ],
    host: "VION Events PLC",
    partners: ["Ethiopian Music Association", "Addis Ababa Culture Bureau", "Heineken Ethiopia"],
    includes: ["Event entry", "Welcome drink", "Festival wristband", "Access to all stages"]
  },
  {
    id: "2",
    slug: "ethiopian-business-summit",
    title: "Ethiopian Business Summit",
    category: "Conference",
    date: "April 8-9, 2026",
    time: "9:00 AM",
    location: "Skylight Hotel, Addis Ababa",
    duration: "2 Days",
    expectedAttendees: 2000,
    ticketPrice: "3,500 ETB",
    image: ethiopianBusinessSummit,
    shortDescription: "The premier business networking event connecting Ethiopian entrepreneurs with global investors.",
    about: "The Ethiopian Business Summit brings together industry leaders, entrepreneurs, investors, and policymakers for two days of insightful panels, keynote speeches, and networking opportunities focused on Ethiopia's rapidly growing economy.",
    details: "This year's summit focuses on digital transformation, sustainable development, and the role of the private sector in Ethiopia's economic renaissance. With keynote speakers from the African Development Bank, Ethiopian Investment Commission, and leading tech companies.",
    whatToExpect: [
      "30+ keynote speeches and panel discussions",
      "One-on-one investor matching sessions",
      "Startup pitch competition with $50,000 prize",
      "Exclusive networking dinner",
      "Exhibition hall with 100+ companies"
    ],
    host: "Ethiopian Chamber of Commerce",
    partners: ["African Development Bank", "Ethiopian Investment Commission", "Safaricom Ethiopia"],
    includes: ["2-day access pass", "Conference materials", "Lunch & refreshments", "Networking dinner", "Certificate of attendance"]
  },
  {
    id: "3",
    slug: "timkat-cultural-festival",
    title: "Timkat Cultural Festival",
    category: "Cultural",
    date: "January 19, 2027",
    time: "7:00 AM",
    location: "Jan Meda, Addis Ababa",
    duration: "Full Day",
    expectedAttendees: 10000,
    ticketPrice: "Free",
    image: timkatFestival,
    shortDescription: "Celebrate Ethiopia's most vibrant cultural event — the Feast of Epiphany like never before.",
    about: "Experience the magic of Timkat, Ethiopia's most colorful and spiritually significant celebration. This UNESCO-recognized festival commemorates the Baptism of Jesus with spectacular processions, traditional music, and communal celebrations that bring together people from all walks of life.",
    details: "Our organized viewing experience includes premium seating areas along the procession route, cultural guides who explain the rich symbolism, and a post-ceremony cultural showcase featuring traditional dance, music, and authentic Ethiopian cuisine.",
    whatToExpect: [
      "Premium viewing of the Timkat procession",
      "Cultural guide and historical narration",
      "Traditional Ethiopian dance performances",
      "Authentic Ethiopian cuisine tasting",
      "Professional photography package"
    ],
    host: "Addis Ababa Tourism Bureau",
    partners: ["Ethiopian Orthodox Church", "UNESCO Ethiopia", "Ethiopian Airlines"],
    includes: ["Premium viewing area", "Cultural guide", "Traditional lunch", "Souvenir package"]
  },
  {
    id: "4",
    slug: "addis-tech-week-2026",
    title: "Addis Tech Week 2026",
    category: "Technology",
    date: "May 20-24, 2026",
    time: "10:00 AM",
    location: "African Union Conference Center",
    duration: "5 Days",
    expectedAttendees: 3000,
    ticketPrice: "2,800 ETB",
    image: addisTechWeek,
    shortDescription: "East Africa's largest technology conference and hackathon bringing innovators together.",
    about: "Addis Tech Week is the flagship technology event in East Africa, featuring world-class speakers, hands-on workshops, a 48-hour hackathon, and an innovation expo showcasing the latest in AI, fintech, agritech, and digital transformation across the continent.",
    details: "Five days of immersive tech experiences including masterclasses by Google and Microsoft engineers, a startup accelerator program, Africa's largest hackathon with over $100,000 in prizes, and an innovation expo featuring 200+ tech companies from across the continent.",
    whatToExpect: [
      "50+ workshops and masterclasses",
      "48-hour hackathon with $100K prizes",
      "Innovation expo with 200+ companies",
      "Startup pitch stage",
      "AI & Web3 deep-dive tracks"
    ],
    host: "iCog Labs",
    partners: ["Google Africa", "Microsoft ADC", "Safaricom Ethiopia", "Ethiopian AI Institute"],
    includes: ["5-day access", "Workshop materials", "Hackathon participation", "Meals & refreshments", "Networking events"]
  },
  {
    id: "5",
    slug: "ethiopian-coffee-festival",
    title: "Ethiopian Coffee Festival",
    category: "Cultural",
    date: "June 12, 2026",
    time: "11:00 AM",
    location: "Entoto Park, Addis Ababa",
    duration: "8 Hours",
    expectedAttendees: 4000,
    ticketPrice: "800 ETB",
    image: coffeeFestival,
    shortDescription: "A celebration of Ethiopia's legendary coffee culture — from bean to cup.",
    about: "As the birthplace of coffee, Ethiopia holds a unique place in global coffee culture. This festival celebrates that heritage with traditional coffee ceremonies, cupping sessions with master roasters, farm-to-cup workshops, and a marketplace featuring the finest single-origin Ethiopian beans.",
    details: "Immerse yourself in the complete Ethiopian coffee journey — from Yirgacheffe to Sidamo, Harrar to Jimma. Expert baristas and coffee farmers guide you through the flavors that make Ethiopian coffee world-renowned. The festival includes a latte art championship and a coffee cocktail bar.",
    whatToExpect: [
      "Traditional coffee ceremony experience",
      "Cupping sessions with master roasters",
      "Farm-to-cup educational workshops",
      "Latte art championship",
      "Premium coffee marketplace"
    ],
    host: "Ethiopian Coffee & Tea Authority",
    partners: ["Tomoca Coffee", "Garden of Coffee", "Yirgacheffe Coffee Farmers Union"],
    includes: ["Festival entry", "Coffee tasting passport", "Souvenir tasting cup", "Workshop access"]
  },
  {
    id: "6",
    slug: "addis-fashion-gala-2026",
    title: "Addis Fashion Gala 2026",
    category: "Fashion",
    date: "July 5, 2026",
    time: "7:00 PM",
    location: "Hyatt Regency, Addis Ababa",
    duration: "5 Hours",
    expectedAttendees: 1500,
    ticketPrice: "4,000 ETB",
    image: fashionGala,
    shortDescription: "A glamorous evening showcasing Ethiopian fashion designers on the international stage.",
    about: "The Addis Fashion Gala is Ethiopia's most prestigious fashion event, spotlighting both established and emerging Ethiopian designers who blend traditional Habesha textiles with contemporary global fashion. The evening features runway shows, a designer marketplace, and a charity auction.",
    details: "This year's gala theme is 'Heritage Reimagined' — celebrating the evolution of Ethiopian fashion from ancient Aksumite textiles to modern haute couture. Twelve designers will present their latest collections on a spectacular runway, followed by an exclusive after-party with live DJ and champagne reception.",
    whatToExpect: [
      "12 designer runway shows",
      "Designer marketplace & pop-up shops",
      "Charity auction for Ethiopian artisans",
      "Champagne reception & gourmet dinner",
      "Live DJ after-party"
    ],
    host: "Addis Fashion Council",
    partners: ["ESHI Leather", "Sabahar", "Muya Ethiopia", "Ethiopian Textile Institute"],
    includes: ["Gala entry", "3-course dinner", "Welcome champagne", "Designer catalog", "After-party access"]
  }
];

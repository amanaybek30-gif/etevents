
-- Events table (for DB-backed events in future, sample events remain static for now)
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  location TEXT NOT NULL,
  duration TEXT,
  expected_attendees INTEGER DEFAULT 0,
  ticket_price TEXT NOT NULL DEFAULT 'Free',
  image_url TEXT,
  short_description TEXT,
  about TEXT,
  details TEXT,
  what_to_expect TEXT[],
  host TEXT,
  partners TEXT[],
  includes TEXT[],
  organizer_id UUID,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anyone can view published events
CREATE POLICY "Anyone can view published events"
  ON public.events FOR SELECT
  USING (is_published = true);

-- Registrations table
CREATE TABLE public.registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id TEXT NOT NULL UNIQUE DEFAULT 'TKT-' || upper(substr(md5(random()::text), 1, 8)),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_slug TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  bank_name TEXT,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  checked_in BOOLEAN DEFAULT false,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- Anyone can create a registration (public booking)
CREATE POLICY "Anyone can create registrations"
  ON public.registrations FOR INSERT
  WITH CHECK (true);

-- Users can view their own registration by email (will be enhanced with auth later)
CREATE POLICY "Anyone can view registrations"
  ON public.registrations FOR SELECT
  USING (true);

-- Storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public)
  VALUES ('receipts', 'receipts', false)
  ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload receipts
CREATE POLICY "Anyone can upload receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts');

-- Allow reading receipts (admin will be restricted later)
CREATE POLICY "Anyone can view receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts');

-- Seed sample events into the events table
INSERT INTO public.events (slug, title, category, date, time, location, duration, expected_attendees, ticket_price, short_description, about, details, what_to_expect, host, partners, includes, is_published)
VALUES 
('addis-music-fest-2026', 'Addis Music Fest 2026', 'Concert', 'March 15, 2026', '6:00 PM', 'Millennium Hall, Addis Ababa', '6 Hours', 5000, '1,500 ETB', 'Ethiopia''s biggest music celebration featuring top artists from across the nation.', 'Addis Music Fest is the premier annual music festival in Ethiopia.', 'Experience six hours of non-stop live performances.', ARRAY['Live performances by 20+ artists', 'Ethio-jazz & Amharic pop stages', 'Traditional Ethiopian food court'], 'VION Events PLC', ARRAY['Ethiopian Music Association', 'Addis Ababa Culture Bureau'], ARRAY['Event entry', 'Welcome drink', 'Festival wristband'], true),
('ethiopian-business-summit', 'Ethiopian Business Summit', 'Conference', 'April 8-9, 2026', '9:00 AM', 'Skylight Hotel, Addis Ababa', '2 Days', 2000, '3,500 ETB', 'The premier business networking event.', 'The Ethiopian Business Summit brings together industry leaders.', 'This year focuses on digital transformation.', ARRAY['30+ keynote speeches', 'Investor matching sessions', 'Startup pitch competition'], 'Ethiopian Chamber of Commerce', ARRAY['African Development Bank', 'Ethiopian Investment Commission'], ARRAY['2-day access pass', 'Conference materials', 'Lunch & refreshments'], true),
('timkat-cultural-festival', 'Timkat Cultural Festival', 'Cultural', 'January 19, 2027', '7:00 AM', 'Jan Meda, Addis Ababa', 'Full Day', 10000, 'Free', 'Celebrate Ethiopia''s most vibrant cultural event.', 'Experience the magic of Timkat.', 'Our organized viewing experience includes premium seating.', ARRAY['Premium viewing of procession', 'Cultural guide', 'Traditional dance performances'], 'Addis Ababa Tourism Bureau', ARRAY['Ethiopian Orthodox Church', 'UNESCO Ethiopia'], ARRAY['Premium viewing area', 'Cultural guide', 'Traditional lunch'], true),
('addis-tech-week-2026', 'Addis Tech Week 2026', 'Technology', 'May 20-24, 2026', '10:00 AM', 'African Union Conference Center', '5 Days', 3000, '2,800 ETB', 'East Africa''s largest technology conference.', 'Addis Tech Week is the flagship technology event.', 'Five days of immersive tech experiences.', ARRAY['50+ workshops', '48-hour hackathon', 'Innovation expo'], 'iCog Labs', ARRAY['Google Africa', 'Microsoft ADC'], ARRAY['5-day access', 'Workshop materials', 'Hackathon participation'], true),
('ethiopian-coffee-festival', 'Ethiopian Coffee Festival', 'Cultural', 'June 12, 2026', '11:00 AM', 'Entoto Park, Addis Ababa', '8 Hours', 4000, '800 ETB', 'A celebration of Ethiopia''s legendary coffee culture.', 'As the birthplace of coffee, Ethiopia holds a unique place.', 'Immerse yourself in the complete Ethiopian coffee journey.', ARRAY['Traditional coffee ceremony', 'Cupping sessions', 'Farm-to-cup workshops'], 'Ethiopian Coffee & Tea Authority', ARRAY['Tomoca Coffee', 'Garden of Coffee'], ARRAY['Festival entry', 'Coffee tasting passport', 'Souvenir cup'], true),
('addis-fashion-gala-2026', 'Addis Fashion Gala 2026', 'Fashion', 'July 5, 2026', '7:00 PM', 'Hyatt Regency, Addis Ababa', '5 Hours', 1500, '4,000 ETB', 'A glamorous evening showcasing Ethiopian fashion designers.', 'The Addis Fashion Gala is Ethiopia''s most prestigious fashion event.', 'This year''s theme is Heritage Reimagined.', ARRAY['12 designer runway shows', 'Designer marketplace', 'Charity auction'], 'Addis Fashion Council', ARRAY['ESHI Leather', 'Sabahar', 'Muya Ethiopia'], ARRAY['Gala entry', '3-course dinner', 'Welcome champagne'], true);

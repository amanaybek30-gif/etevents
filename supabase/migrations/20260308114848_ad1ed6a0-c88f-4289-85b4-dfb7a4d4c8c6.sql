
-- Add profile fields to organizer_profiles
ALTER TABLE public.organizer_profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS event_categories text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_profile_public boolean DEFAULT true;

-- Allow anyone to view public organizer profiles
CREATE POLICY "Anyone can view public organizer profiles" ON public.organizer_profiles
  FOR SELECT USING (is_profile_public = true);

-- Create saved_events table
CREATE TABLE IF NOT EXISTS public.saved_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);

ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved events" ON public.saved_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create vendor_registrations table
CREATE TABLE IF NOT EXISTS public.vendor_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  vendor_name text NOT NULL,
  brand_name text,
  contact_person text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  vendor_type text NOT NULL DEFAULT 'exhibitor',
  description text,
  website text,
  booth_size text,
  power_required boolean DEFAULT false,
  special_requirements text,
  files text[],
  status text NOT NULL DEFAULT 'pending',
  organizer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_registrations ENABLE ROW LEVEL SECURITY;

-- Anyone can submit vendor registrations (public form)
CREATE POLICY "Anyone can submit vendor registrations" ON public.vendor_registrations
  FOR INSERT WITH CHECK (true);

-- Organizers can view vendor registrations for their events
CREATE POLICY "Organizers can view own event vendors" ON public.vendor_registrations
  FOR SELECT USING (event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid()));

-- Organizers can update vendor registrations for their events
CREATE POLICY "Organizers can update own event vendors" ON public.vendor_registrations
  FOR UPDATE USING (event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid()));

-- Organizers can delete vendor registrations for their events
CREATE POLICY "Organizers can delete own event vendors" ON public.vendor_registrations
  FOR DELETE USING (event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid()));

-- Admins can manage all vendor registrations
CREATE POLICY "Admins can manage all vendors" ON public.vendor_registrations
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add vendor_registration_enabled to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS vendor_registration_enabled boolean DEFAULT false;

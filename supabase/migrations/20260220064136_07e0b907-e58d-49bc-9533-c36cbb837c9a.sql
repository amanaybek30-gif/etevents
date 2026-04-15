
-- Fix RLS: organizers can create events (ensure organizer_id matches auth.uid())
-- The issue was that organizer_id might not be set correctly. Let's ensure the policy is correct.
-- Drop and recreate to be safe.
DROP POLICY IF EXISTS "Organizers can create events" ON public.events;
CREATE POLICY "Organizers can create events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'organizer'::app_role) AND auth.uid() = organizer_id);

-- Also add image_url storage for event posters
INSERT INTO storage.buckets (id, name, public) 
VALUES ('event-posters', 'event-posters', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view event posters"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-posters');

CREATE POLICY "Organizers can upload event posters"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'event-posters' AND auth.role() = 'authenticated');

CREATE POLICY "Organizers can update event posters"
ON storage.objects FOR UPDATE
USING (bucket_id = 'event-posters' AND auth.role() = 'authenticated');

-- Add payment_info column to events if not exists (for storing organizer payment details)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS payment_info jsonb DEFAULT NULL;

-- Add host and partner columns if not exists
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS host text DEFAULT NULL;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS partners text[] DEFAULT NULL;

-- Add what_to_expect column if not exists
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS what_to_expect text[] DEFAULT NULL;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS includes text[] DEFAULT NULL;

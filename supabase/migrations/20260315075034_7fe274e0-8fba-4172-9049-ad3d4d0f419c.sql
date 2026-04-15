
-- Add event_date and duration columns to attendee_imports for subscription tracking
ALTER TABLE public.attendee_imports ADD COLUMN IF NOT EXISTS event_date text;
ALTER TABLE public.attendee_imports ADD COLUMN IF NOT EXISTS event_duration text DEFAULT '1 day';

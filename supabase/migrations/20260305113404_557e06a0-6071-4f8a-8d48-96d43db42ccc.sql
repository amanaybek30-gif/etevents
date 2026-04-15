
-- Add email_sent tracking to registrations
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS email_sent boolean DEFAULT null;

-- Add subscription fields to organizer_profiles
ALTER TABLE public.organizer_profiles ADD COLUMN IF NOT EXISTS subscription_paid boolean DEFAULT false;
ALTER TABLE public.organizer_profiles ADD COLUMN IF NOT EXISTS subscription_expires_at timestamp with time zone DEFAULT null;

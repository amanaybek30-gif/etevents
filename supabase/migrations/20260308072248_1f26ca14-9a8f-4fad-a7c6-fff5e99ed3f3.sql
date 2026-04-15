
-- Add banned_emails table for permanently banned users
CREATE TABLE IF NOT EXISTS public.banned_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  phone text,
  banned_at timestamp with time zone NOT NULL DEFAULT now(),
  banned_by uuid,
  reason text DEFAULT 'Removed by admin'
);

ALTER TABLE public.banned_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage banned emails"
ON public.banned_emails
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add suspended column to organizer_profiles
ALTER TABLE public.organizer_profiles ADD COLUMN IF NOT EXISTS is_suspended boolean DEFAULT false;

-- Add attendee_profiles table for CRM
CREATE TABLE IF NOT EXISTS public.attendee_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  phone text,
  full_name text NOT NULL,
  organization text,
  job_title text,
  organizer_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(email, organizer_id)
);

ALTER TABLE public.attendee_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage own attendee profiles"
ON public.attendee_profiles
FOR ALL
USING (organizer_id = auth.uid())
WITH CHECK (organizer_id = auth.uid());


-- Attendee user profiles table
CREATE TABLE public.attendee_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  bio text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.attendee_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attendee account"
ON public.attendee_accounts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attendee account"
ON public.attendee_accounts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attendee account"
ON public.attendee_accounts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add 'attendee' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'attendee';

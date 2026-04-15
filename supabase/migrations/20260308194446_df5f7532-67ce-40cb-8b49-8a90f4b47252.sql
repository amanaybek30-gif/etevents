
-- Table for managing check-in staff per event
CREATE TABLE public.event_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organizer_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  access_token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_staff ENABLE ROW LEVEL SECURITY;

-- Organizers can manage their own staff
CREATE POLICY "Organizers can manage own event staff"
ON public.event_staff FOR ALL
USING (organizer_id = auth.uid())
WITH CHECK (organizer_id = auth.uid());

-- Admins can manage all staff
CREATE POLICY "Admins can manage all event staff"
ON public.event_staff FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Anyone can read staff by token (for the public check-in page)
CREATE POLICY "Anyone can read staff by access token"
ON public.event_staff FOR SELECT
USING (true);

-- Enable realtime for registrations (if not already)
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_staff;

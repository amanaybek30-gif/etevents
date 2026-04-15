
-- 1. Waitlist table
CREATE TABLE public.event_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  position integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'waiting',
  invite_token text,
  invited_at timestamptz,
  invite_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  custom_answers jsonb
);

ALTER TABLE public.event_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can view own event waitlist" ON public.event_waitlist
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid()));

CREATE POLICY "Organizers can update own event waitlist" ON public.event_waitlist
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid()));

CREATE POLICY "Organizers can delete own event waitlist" ON public.event_waitlist
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid()));

CREATE POLICY "Anyone can join waitlist" ON public.event_waitlist
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage all waitlist" ON public.event_waitlist
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 2. Event discussions table
CREATE TABLE public.event_discussions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_email text,
  question text NOT NULL,
  answer text,
  answered_by uuid,
  answered_at timestamptz,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_discussions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible discussions" ON public.event_discussions
  FOR SELECT USING (is_visible = true);

CREATE POLICY "Anyone can post questions" ON public.event_discussions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Organizers can manage own event discussions" ON public.event_discussions
  FOR ALL TO authenticated
  USING (event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid()))
  WITH CHECK (event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid()));

CREATE POLICY "Admins can manage all discussions" ON public.event_discussions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 3. Add waitlist_enabled to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS waitlist_enabled boolean DEFAULT false;

-- 4. Add checked_in_by to registrations for staff tracking
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS checked_in_by uuid;

-- 5. Enable realtime for waitlist and discussions
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_waitlist;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_discussions;


-- =============================================
-- FIX: Drop all RESTRICTIVE policies on events table
-- and recreate them as PERMISSIVE
-- =============================================

-- Drop existing restrictive policies on events
DROP POLICY IF EXISTS "Admins can manage all events" ON public.events;
DROP POLICY IF EXISTS "Anyone can view published events" ON public.events;
DROP POLICY IF EXISTS "Organizers can create events" ON public.events;
DROP POLICY IF EXISTS "Organizers can delete own events" ON public.events;
DROP POLICY IF EXISTS "Organizers can update own events" ON public.events;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can manage all events"
ON public.events FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view published events"
ON public.events FOR SELECT TO anon, authenticated
USING (is_published = true);

CREATE POLICY "Organizers can view own events"
ON public.events FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'organizer'::app_role) AND auth.uid() = organizer_id);

CREATE POLICY "Organizers can create events"
ON public.events FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'organizer'::app_role) AND auth.uid() = organizer_id);

CREATE POLICY "Organizers can update own events"
ON public.events FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'organizer'::app_role) AND auth.uid() = organizer_id)
WITH CHECK (has_role(auth.uid(), 'organizer'::app_role) AND auth.uid() = organizer_id);

CREATE POLICY "Organizers can delete own events"
ON public.events FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'organizer'::app_role) AND auth.uid() = organizer_id);

-- =============================================
-- FIX: Drop all RESTRICTIVE policies on registrations table
-- and recreate them as PERMISSIVE
-- =============================================

DROP POLICY IF EXISTS "Admins can manage all registrations" ON public.registrations;
DROP POLICY IF EXISTS "Anyone can create registrations" ON public.registrations;
DROP POLICY IF EXISTS "Organizers can update own event registrations" ON public.registrations;
DROP POLICY IF EXISTS "Organizers can view own event registrations" ON public.registrations;

CREATE POLICY "Admins can manage all registrations"
ON public.registrations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can create registrations"
ON public.registrations FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Organizers can view own event registrations"
ON public.registrations FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'organizer'::app_role) AND
  event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid())
);

CREATE POLICY "Organizers can update own event registrations"
ON public.registrations FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'organizer'::app_role) AND
  event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'organizer'::app_role) AND
  event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid())
);

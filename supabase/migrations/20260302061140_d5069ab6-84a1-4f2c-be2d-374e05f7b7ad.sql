
-- Drop all existing registrations policies
DROP POLICY IF EXISTS "Admins can manage all registrations" ON public.registrations;
DROP POLICY IF EXISTS "Anyone can create registrations" ON public.registrations;
DROP POLICY IF EXISTS "Organizers can view own event registrations" ON public.registrations;
DROP POLICY IF EXISTS "Organizers can update own event registrations" ON public.registrations;

-- Recreate all as PERMISSIVE (OR logic)
CREATE POLICY "Anyone can create registrations"
ON public.registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can select all registrations"
ON public.registrations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all registrations"
ON public.registrations
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete all registrations"
ON public.registrations
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Organizers can view own event registrations"
ON public.registrations
FOR SELECT
TO authenticated
USING (event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid()));

CREATE POLICY "Organizers can update own event registrations"
ON public.registrations
FOR UPDATE
TO authenticated
USING (event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid()));

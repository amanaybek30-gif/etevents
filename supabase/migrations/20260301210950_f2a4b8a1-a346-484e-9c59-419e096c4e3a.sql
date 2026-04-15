
-- 1. Recreate the missing trigger
CREATE OR REPLACE TRIGGER on_organizer_profile_created
  AFTER INSERT ON public.organizer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_organizer_role();

-- 2. Fix ALL policies to be explicitly PERMISSIVE

-- EVENTS
DROP POLICY IF EXISTS "Admins can manage all events" ON public.events;
DROP POLICY IF EXISTS "Anyone can view published events" ON public.events;
DROP POLICY IF EXISTS "Organizers can view own events" ON public.events;
DROP POLICY IF EXISTS "Organizers can create events" ON public.events;
DROP POLICY IF EXISTS "Organizers can update own events" ON public.events;
DROP POLICY IF EXISTS "Organizers can delete own events" ON public.events;

CREATE POLICY "Admins can manage all events"
ON public.events AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view published events"
ON public.events AS PERMISSIVE FOR SELECT TO anon, authenticated
USING (is_published = true);

CREATE POLICY "Organizers can view own events"
ON public.events AS PERMISSIVE FOR SELECT TO authenticated
USING (auth.uid() = organizer_id);

CREATE POLICY "Organizers can create events"
ON public.events AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can update own events"
ON public.events AS PERMISSIVE FOR UPDATE TO authenticated
USING (auth.uid() = organizer_id)
WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can delete own events"
ON public.events AS PERMISSIVE FOR DELETE TO authenticated
USING (auth.uid() = organizer_id);

-- REGISTRATIONS
DROP POLICY IF EXISTS "Admins can manage all registrations" ON public.registrations;
DROP POLICY IF EXISTS "Anyone can create registrations" ON public.registrations;
DROP POLICY IF EXISTS "Organizers can view own event registrations" ON public.registrations;
DROP POLICY IF EXISTS "Organizers can update own event registrations" ON public.registrations;

CREATE POLICY "Admins can manage all registrations"
ON public.registrations AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can create registrations"
ON public.registrations AS PERMISSIVE FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Organizers can view own event registrations"
ON public.registrations AS PERMISSIVE FOR SELECT TO authenticated
USING (event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid()));

CREATE POLICY "Organizers can update own event registrations"
ON public.registrations AS PERMISSIVE FOR UPDATE TO authenticated
USING (event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid()))
WITH CHECK (event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid()));

-- ORGANIZER_PROFILES
DROP POLICY IF EXISTS "Users can insert own profile" ON public.organizer_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.organizer_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.organizer_profiles;
DROP POLICY IF EXISTS "Admins can manage organizer profiles" ON public.organizer_profiles;

CREATE POLICY "Users can insert own profile"
ON public.organizer_profiles AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.organizer_profiles AS PERMISSIVE FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own profile"
ON public.organizer_profiles AS PERMISSIVE FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage organizer profiles"
ON public.organizer_profiles AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));


-- Fix organizer_profiles RLS policies (also RESTRICTIVE -> PERMISSIVE)
DROP POLICY IF EXISTS "Organizers can insert own profile" ON public.organizer_profiles;
DROP POLICY IF EXISTS "Organizers can update own profile" ON public.organizer_profiles;
DROP POLICY IF EXISTS "Organizers can view own profile" ON public.organizer_profiles;

-- Recreate as PERMISSIVE
CREATE POLICY "Users can insert own profile"
ON public.organizer_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.organizer_profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own profile"
ON public.organizer_profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Admin can view all organizer profiles
CREATE POLICY "Admins can manage organizer profiles"
ON public.organizer_profiles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

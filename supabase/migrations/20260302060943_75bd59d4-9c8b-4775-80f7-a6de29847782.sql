
-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Anyone can create registrations" ON public.registrations;

CREATE POLICY "Anyone can create registrations"
ON public.registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

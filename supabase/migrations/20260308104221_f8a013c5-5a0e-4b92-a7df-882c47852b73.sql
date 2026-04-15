
-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "Anyone can create registrations" ON public.registrations;

-- Recreate as PERMISSIVE
CREATE POLICY "Anyone can create registrations"
ON public.registrations
FOR INSERT
TO public
WITH CHECK (true);

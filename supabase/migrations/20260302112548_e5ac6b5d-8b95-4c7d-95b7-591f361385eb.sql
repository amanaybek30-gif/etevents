-- The disputes table currently relies on a single restrictive ALL policy for admins.
-- Add an explicit permissive policy ensuring only admins can manage disputes,
-- preventing any non-admin authenticated user from inserting records.

-- Drop the existing restrictive policy and recreate as permissive for proper RLS behavior
DROP POLICY IF EXISTS "Admins can manage disputes" ON public.disputes;

CREATE POLICY "Admins can manage disputes"
  ON public.disputes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
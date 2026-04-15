
-- Fix 1: Remove overly permissive SELECT on registrations
DROP POLICY IF EXISTS "Anyone can view registrations" ON public.registrations;

-- Fix 2: Remove overly permissive SELECT on receipts storage
DROP POLICY IF EXISTS "Anyone can view receipts" ON storage.objects;

-- Add role-based receipt access for admins
CREATE POLICY "Admins can view receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receipts' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add role-based receipt access for organizers (their event receipts only)
CREATE POLICY "Organizers can view event receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receipts' AND
  has_role(auth.uid(), 'organizer'::app_role) AND
  EXISTS (
    SELECT 1 FROM events
    WHERE organizer_id = auth.uid()
    AND (storage.objects.name LIKE slug || '/%')
  )
);

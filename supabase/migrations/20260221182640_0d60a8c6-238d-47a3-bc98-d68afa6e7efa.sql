-- Fix 1: Replace LIKE-based receipt storage policy with join-based validation
DROP POLICY IF EXISTS "Organizers can view event receipts" ON storage.objects;

CREATE POLICY "Organizers can view event receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receipts' AND
  has_role(auth.uid(), 'organizer'::app_role) AND
  EXISTS (
    SELECT 1 
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    WHERE e.organizer_id = auth.uid()
    AND r.receipt_url = storage.objects.name
  )
);

-- Fix 2: Add server-side input validation constraints on registrations
ALTER TABLE registrations
ADD CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'),
ADD CONSTRAINT valid_phone CHECK (length(phone) BETWEEN 7 AND 20),
ADD CONSTRAINT valid_name CHECK (length(full_name) BETWEEN 1 AND 200);

-- Fix 3: Add validation trigger to prevent path traversal in receipt_url
CREATE OR REPLACE FUNCTION public.validate_receipt_path()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF NEW.receipt_url IS NOT NULL THEN
    IF NEW.receipt_url LIKE '%..%' OR NEW.receipt_url LIKE '%//%' THEN
      RAISE EXCEPTION 'Invalid receipt path';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_receipt_path
BEFORE INSERT OR UPDATE ON registrations
FOR EACH ROW
EXECUTE FUNCTION public.validate_receipt_path();
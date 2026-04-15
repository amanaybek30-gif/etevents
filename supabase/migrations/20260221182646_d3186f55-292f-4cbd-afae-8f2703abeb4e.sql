-- Fix search_path on validate_receipt_path function
CREATE OR REPLACE FUNCTION public.validate_receipt_path()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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
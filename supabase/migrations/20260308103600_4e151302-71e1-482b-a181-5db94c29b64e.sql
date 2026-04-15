
CREATE OR REPLACE FUNCTION public.get_event_for_registration(event_slug text)
RETURNS TABLE(event_id uuid, event_title text, event_slug_out text, event_date text, event_time text, event_location text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.title, e.slug, e.date, e."time", e.location
  FROM events e
  WHERE e.slug = event_slug
  LIMIT 1;
END;
$$;

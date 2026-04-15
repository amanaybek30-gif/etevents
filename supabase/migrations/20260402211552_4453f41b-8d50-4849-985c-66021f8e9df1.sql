CREATE OR REPLACE FUNCTION public.get_homepage_live_stats()
RETURNS TABLE(
  events_count bigint,
  registrations_count bigint,
  organizers_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      SELECT COUNT(*)
      FROM public.events e
      WHERE e.is_published = true
    ) AS events_count,
    (
      SELECT COUNT(*)
      FROM public.registrations r
    ) AS registrations_count,
    (
      SELECT COUNT(*)
      FROM public.organizer_profiles op
    ) AS organizers_count;
$$;

GRANT EXECUTE ON FUNCTION public.get_homepage_live_stats() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_organizer_remaining_slots(event_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_id uuid;
  org_plan text;
  max_slots integer;
  current_count integer;
BEGIN
  SELECT organizer_id INTO org_id FROM events WHERE id = event_uuid;
  IF org_id IS NULL THEN RETURN 0; END IF;

  SELECT subscription_plan INTO org_plan FROM organizer_profiles WHERE user_id = org_id;
  IF org_plan IS NULL THEN org_plan := 'free'; END IF;

  IF org_plan = 'corporate' THEN RETURN 999999; END IF;
  IF org_plan = 'pro' THEN max_slots := 300;
  ELSIF org_plan = 'organizer' THEN max_slots := 100;
  ELSE max_slots := 100;
  END IF;

  SELECT COUNT(*)::integer INTO current_count FROM registrations
  WHERE event_id IN (SELECT id FROM events WHERE organizer_id = org_id);

  RETURN GREATEST(max_slots - current_count, 0);
END;
$$;

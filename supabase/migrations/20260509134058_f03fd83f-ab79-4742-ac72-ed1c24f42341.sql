-- Registrations are now unlimited for every paid plan
CREATE OR REPLACE FUNCTION public.get_organizer_remaining_slots(event_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Registrations are unlimited under the new event-based plans.
  -- Function kept for backward compatibility with existing callers.
  RETURN 999999;
END;
$function$;

-- Returns number of additional events the organizer can still create
-- in the current subscription period (1-year window ending at subscription_expires_at).
CREATE OR REPLACE FUNCTION public.get_organizer_remaining_events(uid uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  org_plan text;
  paid boolean;
  expires timestamptz;
  period_start timestamptz;
  max_events integer;
  used integer;
BEGIN
  SELECT subscription_plan, subscription_paid, subscription_expires_at
    INTO org_plan, paid, expires
  FROM organizer_profiles
  WHERE user_id = uid;

  IF org_plan IS NULL THEN org_plan := 'free'; END IF;

  IF org_plan = 'corporate' THEN max_events := 7;
  ELSIF org_plan = 'pro' THEN max_events := 3;
  ELSIF org_plan = 'organizer' THEN max_events := 1;
  ELSE max_events := 0;
  END IF;

  IF NOT COALESCE(paid, false) OR expires IS NULL OR expires < now() THEN
    RETURN 0;
  END IF;

  period_start := expires - interval '1 year';

  SELECT COUNT(*)::int INTO used
  FROM events
  WHERE organizer_id = uid
    AND created_at >= period_start;

  RETURN GREATEST(max_events - COALESCE(used, 0), 0);
END;
$function$;

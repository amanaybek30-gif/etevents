
DROP FUNCTION IF EXISTS public.staff_get_event_stats(text);

CREATE OR REPLACE FUNCTION public.staff_get_event_stats(p_access_token text)
 RETURNS TABLE(total_approved bigint, total_checked_in bigint, recent_checkins jsonb, my_checkins bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
  v_is_active boolean;
  v_staff_id uuid;
BEGIN
  SELECT es.event_id, es.is_active, es.id INTO v_event_id, v_is_active, v_staff_id
  FROM event_staff es
  WHERE es.access_token = p_access_token
  LIMIT 1;

  IF v_event_id IS NULL OR NOT v_is_active THEN
    total_approved := 0;
    total_checked_in := 0;
    recent_checkins := '[]'::jsonb;
    my_checkins := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT COUNT(*) FILTER (WHERE r.status = 'approved'),
         COUNT(*) FILTER (WHERE COALESCE(r.checked_in, false) = true),
         COUNT(*) FILTER (WHERE COALESCE(r.checked_in, false) = true AND r.checked_in_by = v_staff_id)
  INTO total_approved, total_checked_in, my_checkins
  FROM registrations r
  WHERE r.event_id = v_event_id;

  SELECT COALESCE(jsonb_agg(sub ORDER BY sub.cat DESC), '[]'::jsonb)
  INTO recent_checkins
  FROM (
    SELECT jsonb_build_object(
      'name', r.full_name,
      'ticketId', r.ticket_id,
      'time', r.checked_in_at
    ) AS sub, r.checked_in_at AS cat
    FROM registrations r
    WHERE r.event_id = v_event_id
      AND COALESCE(r.checked_in, false) = true
      AND r.checked_in_at IS NOT NULL
    ORDER BY r.checked_in_at DESC
    LIMIT 10
  ) t;

  RETURN NEXT;
  RETURN;
END;
$function$;

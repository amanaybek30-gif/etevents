
-- RPC for staff to search attendees by name/email/phone
CREATE OR REPLACE FUNCTION public.staff_search_attendees(
  p_access_token text,
  p_query text
)
RETURNS TABLE(
  ticket_id text,
  full_name text,
  email text,
  phone text,
  checked_in boolean,
  checked_in_at timestamptz,
  status text,
  attendee_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_is_active boolean;
BEGIN
  -- Validate staff token
  SELECT es.event_id, es.is_active INTO v_event_id, v_is_active
  FROM event_staff es
  WHERE es.access_token = p_access_token
  LIMIT 1;

  IF v_event_id IS NULL OR NOT v_is_active THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT r.ticket_id, r.full_name, r.email, r.phone, 
         COALESCE(r.checked_in, false), r.checked_in_at, r.status, r.attendee_type
  FROM registrations r
  WHERE r.event_id = v_event_id
    AND r.status = 'approved'
    AND (
      r.full_name ILIKE '%' || p_query || '%'
      OR r.email ILIKE '%' || p_query || '%'
      OR r.phone ILIKE '%' || p_query || '%'
    )
  LIMIT 50;
END;
$$;

-- RPC for staff to check in an attendee by ticket ID
CREATE OR REPLACE FUNCTION public.staff_checkin_attendee(
  p_access_token text,
  p_ticket_id text
)
RETURNS TABLE(
  result_status text,
  attendee_name text,
  attendee_email text,
  checked_in_time timestamptz,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_is_active boolean;
  v_staff_id uuid;
  v_reg record;
BEGIN
  -- Validate staff token
  SELECT es.event_id, es.is_active, es.id INTO v_event_id, v_is_active, v_staff_id
  FROM event_staff es
  WHERE es.access_token = p_access_token
  LIMIT 1;

  IF v_event_id IS NULL OR NOT v_is_active THEN
    result_status := 'error';
    attendee_name := '';
    attendee_email := '';
    checked_in_time := NULL;
    message := 'Invalid or inactive staff token';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Find registration
  SELECT r.* INTO v_reg
  FROM registrations r
  WHERE r.ticket_id = TRIM(p_ticket_id)
    AND r.event_id = v_event_id;

  IF v_reg IS NULL THEN
    result_status := 'error';
    attendee_name := '';
    attendee_email := '';
    checked_in_time := NULL;
    message := 'Ticket not found for this event';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_reg.status != 'approved' THEN
    result_status := 'error';
    attendee_name := v_reg.full_name;
    attendee_email := v_reg.email;
    checked_in_time := NULL;
    message := 'Ticket not approved';
    RETURN NEXT;
    RETURN;
  END IF;

  IF COALESCE(v_reg.checked_in, false) THEN
    result_status := 'duplicate';
    attendee_name := v_reg.full_name;
    attendee_email := v_reg.email;
    checked_in_time := v_reg.checked_in_at;
    message := 'Already checked in';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Perform check-in
  UPDATE registrations
  SET checked_in = true,
      checked_in_at = now(),
      checked_in_by = v_staff_id
  WHERE ticket_id = TRIM(p_ticket_id)
    AND event_id = v_event_id;

  result_status := 'success';
  attendee_name := v_reg.full_name;
  attendee_email := v_reg.email;
  checked_in_time := now();
  message := 'Successfully checked in';
  RETURN NEXT;
  RETURN;
END;
$$;

-- RPC for staff to get event stats
CREATE OR REPLACE FUNCTION public.staff_get_event_stats(
  p_access_token text
)
RETURNS TABLE(
  total_approved bigint,
  total_checked_in bigint,
  recent_checkins jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_is_active boolean;
BEGIN
  SELECT es.event_id, es.is_active INTO v_event_id, v_is_active
  FROM event_staff es
  WHERE es.access_token = p_access_token
  LIMIT 1;

  IF v_event_id IS NULL OR NOT v_is_active THEN
    total_approved := 0;
    total_checked_in := 0;
    recent_checkins := '[]'::jsonb;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT COUNT(*) FILTER (WHERE r.status = 'approved'),
         COUNT(*) FILTER (WHERE COALESCE(r.checked_in, false) = true)
  INTO total_approved, total_checked_in
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
$$;

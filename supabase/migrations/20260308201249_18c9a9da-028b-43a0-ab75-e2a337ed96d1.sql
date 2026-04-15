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
  v_ticket_norm text;
BEGIN
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

  v_ticket_norm := upper(regexp_replace(coalesce(trim(p_ticket_id), ''), '[^A-Za-z0-9]', '', 'g'));

  IF v_ticket_norm = '' THEN
    result_status := 'error';
    attendee_name := '';
    attendee_email := '';
    checked_in_time := NULL;
    message := 'Invalid ticket value';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT r.* INTO v_reg
  FROM registrations r
  WHERE r.event_id = v_event_id
    AND upper(regexp_replace(coalesce(r.ticket_id, ''), '[^A-Za-z0-9]', '', 'g')) = v_ticket_norm
  LIMIT 1;

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

  UPDATE registrations
  SET checked_in = true,
      checked_in_at = now(),
      checked_in_by = v_staff_id
  WHERE event_id = v_event_id
    AND upper(regexp_replace(coalesce(ticket_id, ''), '[^A-Za-z0-9]', '', 'g')) = v_ticket_norm;

  result_status := 'success';
  attendee_name := v_reg.full_name;
  attendee_email := v_reg.email;
  checked_in_time := now();
  message := 'Successfully checked in';
  RETURN NEXT;
  RETURN;
END;
$$;
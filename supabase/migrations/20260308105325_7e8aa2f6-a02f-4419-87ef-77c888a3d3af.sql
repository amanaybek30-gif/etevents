CREATE OR REPLACE FUNCTION public.quick_register_self(
  p_event_slug text,
  p_full_name text,
  p_phone text,
  p_email text DEFAULT NULL,
  p_organization text DEFAULT NULL
)
RETURNS TABLE(ticket_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_id uuid;
  v_event_slug text;
  v_ticket_id text;
  v_remaining integer;
BEGIN
  SELECT id, slug
  INTO v_event_id, v_event_slug
  FROM public.events
  WHERE slug = p_event_slug
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF COALESCE(TRIM(p_full_name), '') = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  IF COALESCE(TRIM(p_phone), '') = '' THEN
    RAISE EXCEPTION 'Phone number is required';
  END IF;

  v_remaining := public.get_organizer_remaining_slots(v_event_id);
  IF COALESCE(v_remaining, 0) <= 0 THEN
    RAISE EXCEPTION 'Registration is currently full for this event. The organizer has reached their attendee limit.';
  END IF;

  v_ticket_id := 'TKT-' || UPPER(SUBSTR(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.registrations (
    event_id,
    event_slug,
    full_name,
    email,
    phone,
    payment_method,
    status,
    source,
    attendee_type,
    checked_in,
    checked_in_at,
    ticket_id,
    custom_answers
  ) VALUES (
    v_event_id,
    v_event_slug,
    TRIM(p_full_name),
    CASE
      WHEN COALESCE(TRIM(p_email), '') = '' THEN 'qr-' || EXTRACT(EPOCH FROM now())::bigint || '@self.local'
      ELSE LOWER(TRIM(p_email))
    END,
    TRIM(p_phone),
    'door',
    'approved',
    'qr-self',
    'participant',
    true,
    now(),
    v_ticket_id,
    CASE
      WHEN COALESCE(TRIM(p_organization), '') = '' THEN NULL
      ELSE jsonb_build_object('organization', TRIM(p_organization))
    END
  );

  RETURN QUERY SELECT v_ticket_id;
END;
$$;

REVOKE ALL ON FUNCTION public.quick_register_self(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quick_register_self(text, text, text, text, text) TO anon, authenticated;
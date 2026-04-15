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
  v_full_name text;
  v_phone text;
  v_email text;
  v_organization text;
BEGIN
  SELECT id, slug
  INTO v_event_id, v_event_slug
  FROM public.events
  WHERE slug = TRIM(p_event_slug)
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  v_full_name := LEFT(REGEXP_REPLACE(COALESCE(p_full_name, ''), '\s+', ' ', 'g'), 200);
  v_full_name := TRIM(v_full_name);
  IF v_full_name = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  v_phone := TRIM(COALESCE(p_phone, ''));
  IF v_phone = '' THEN
    RAISE EXCEPTION 'Phone number is required';
  END IF;

  IF LEFT(v_phone, 1) = '+' THEN
    v_phone := '+' || REGEXP_REPLACE(SUBSTRING(v_phone FROM 2), '[^0-9]', '', 'g');
  ELSE
    v_phone := REGEXP_REPLACE(v_phone, '[^0-9]', '', 'g');
  END IF;

  IF LENGTH(v_phone) < 7 OR LENGTH(v_phone) > 20 THEN
    RAISE EXCEPTION 'Phone number must be between 7 and 20 characters';
  END IF;

  v_email := LOWER(TRIM(COALESCE(p_email, '')));
  IF v_email = '' THEN
    v_email := 'qr-' || EXTRACT(EPOCH FROM now())::bigint || '@self.local';
  END IF;

  IF v_email !~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  v_organization := NULLIF(TRIM(COALESCE(p_organization, '')), '');

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
    v_full_name,
    v_email,
    v_phone,
    'door',
    'approved',
    'qr-self',
    'participant',
    true,
    now(),
    v_ticket_id,
    CASE
      WHEN v_organization IS NULL THEN NULL
      ELSE jsonb_build_object('organization', v_organization)
    END
  );

  RETURN QUERY SELECT v_ticket_id;
END;
$$;
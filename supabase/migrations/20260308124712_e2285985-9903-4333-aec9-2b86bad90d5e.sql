
-- Tags for attendees (per organizer)
CREATE TABLE public.attendee_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL,
  attendee_email text NOT NULL,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organizer_id, attendee_email, tag)
);

ALTER TABLE public.attendee_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage own tags"
  ON public.attendee_tags FOR ALL
  TO authenticated
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

-- Notes for attendees (per organizer)
CREATE TABLE public.attendee_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL,
  attendee_email text NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendee_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage own notes"
  ON public.attendee_notes FOR ALL
  TO authenticated
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

-- Smart lists / saved segments (per organizer)
CREATE TABLE public.crm_smart_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_smart_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage own smart lists"
  ON public.crm_smart_lists FOR ALL
  TO authenticated
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());


-- Table to persist import records
CREATE TABLE public.attendee_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  event_title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT,
  imported_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attendee_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage own imports"
  ON public.attendee_imports FOR ALL
  TO authenticated
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

-- Storage bucket for import files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('imports', 'imports', false, 10485760, ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'])
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to imports bucket
CREATE POLICY "Authenticated users can upload imports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'imports');

-- Users can read their own imports
CREATE POLICY "Users can read own imports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'imports');

-- Users can delete their own imports
CREATE POLICY "Users can delete own imports"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'imports');

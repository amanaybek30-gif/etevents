
-- Fix attendee_imports: drop restrictive policy, create permissive one
DROP POLICY IF EXISTS "Organizers can manage own imports" ON public.attendee_imports;

CREATE POLICY "Organizers can manage own imports"
  ON public.attendee_imports FOR ALL
  TO authenticated
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

-- Add storage policies for imports bucket
CREATE POLICY "Organizers can upload own imports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'imports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Organizers can read own imports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'imports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Organizers can delete own imports"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'imports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

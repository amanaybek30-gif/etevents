
-- Fix overly permissive storage policies for imports bucket
DROP POLICY IF EXISTS "Authenticated users can upload imports" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own imports" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own imports" ON storage.objects;

-- Path-restricted: users can only upload to their own folder
CREATE POLICY "Auth users upload own imports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'imports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Auth users read own imports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'imports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Auth users delete own imports"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'imports' AND (storage.foldername(name))[1] = auth.uid()::text);

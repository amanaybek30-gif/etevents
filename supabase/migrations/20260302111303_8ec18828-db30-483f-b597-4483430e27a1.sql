-- Replace the overly permissive anonymous upload policy with a path-restricted version
-- Uploads must go to a subfolder path (event-slug/filename pattern)
DROP POLICY IF EXISTS "Anyone can upload receipts" ON storage.objects;

CREATE POLICY "Anyone can upload receipts with path restriction"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts' AND
    -- Ensure the path has exactly one folder level (event-slug/filename)
    (storage.foldername(name))[1] IS NOT NULL AND
    array_length(string_to_array(name, '/'), 1) = 2
  );
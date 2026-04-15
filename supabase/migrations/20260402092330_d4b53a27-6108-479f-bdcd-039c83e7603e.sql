CREATE POLICY "Authenticated users can upload promo images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'advertisements');

CREATE POLICY "Authenticated users can update promo images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'advertisements')
WITH CHECK (bucket_id = 'advertisements');
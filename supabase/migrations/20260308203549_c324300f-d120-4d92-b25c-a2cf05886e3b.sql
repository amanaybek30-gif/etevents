CREATE POLICY "Anyone can submit disputes"
ON public.disputes
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
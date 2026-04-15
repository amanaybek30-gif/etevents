CREATE POLICY "Anyone can view registration by ticket_id"
ON public.registrations
FOR SELECT
TO anon
USING (true);
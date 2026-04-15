
-- Allow anyone (including unauthenticated users) to insert registrations (public registration)
CREATE POLICY "Anyone can register for events"
ON public.registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

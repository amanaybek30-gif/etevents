DROP POLICY IF EXISTS "Anyone can create registrations" ON public.registrations;

CREATE POLICY "Admins can insert all registrations"
ON public.registrations
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Organizers can insert own event registrations"
ON public.registrations
FOR INSERT
TO authenticated
WITH CHECK (
  event_id IN (
    SELECT e.id
    FROM public.events e
    WHERE e.organizer_id = auth.uid()
  )
);
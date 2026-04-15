
-- Allow organizers to delete registrations for their own events
CREATE POLICY "Organizers can delete own event registrations"
ON public.registrations
FOR DELETE
USING (event_id IN (
  SELECT events.id FROM events WHERE events.organizer_id = auth.uid()
));

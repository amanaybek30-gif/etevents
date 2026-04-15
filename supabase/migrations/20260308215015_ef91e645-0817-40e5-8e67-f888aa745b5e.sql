
-- Allow admins full access to attendee_accounts
CREATE POLICY "Admins can manage all attendee accounts"
ON public.attendee_accounts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete attendee accounts
CREATE POLICY "Admins can delete attendee accounts"
ON public.attendee_accounts
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));


-- Allow anyone to view active surveys (for public survey pages)
CREATE POLICY "Anyone can view active surveys"
ON public.surveys
FOR SELECT
USING (is_active = true);

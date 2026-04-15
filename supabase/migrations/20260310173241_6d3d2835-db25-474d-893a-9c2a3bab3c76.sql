
CREATE TABLE public.event_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert event views" ON public.event_views
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Organizers can view own event views" ON public.event_views
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid()));

CREATE POLICY "Admins can manage all event views" ON public.event_views
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_event_views_event_id ON public.event_views(event_id);
CREATE INDEX idx_event_views_created_at ON public.event_views(created_at);

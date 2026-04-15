
CREATE TABLE public.staff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_token text NOT NULL,
  session_id text NOT NULL,
  device_type text NOT NULL DEFAULT 'desktop',
  last_heartbeat timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_sessions_token ON public.staff_sessions(staff_token);

ALTER TABLE public.staff_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can manage staff sessions"
  ON public.staff_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

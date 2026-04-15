
-- 1. Disputes table
CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name text NOT NULL,
  user_email text NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  event_title text NOT NULL,
  issue text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage disputes" ON public.disputes AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Admin logs table
CREATE TABLE public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view logs" ON public.admin_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create logs" ON public.admin_logs AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Platform settings table
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage settings" ON public.platform_settings AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can read settings" ON public.platform_settings AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);

-- Insert default settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('platform_fee_percent', '5'),
  ('payment_bank_name', 'Commercial Bank of Ethiopia'),
  ('payment_account_number', ''),
  ('payment_telebirr_number', ''),
  ('support_email', 'support@etevents.com');

-- 4. Admin notifications table
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  target text NOT NULL DEFAULT 'all',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage notifications" ON public.admin_notifications AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

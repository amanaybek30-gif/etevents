
-- Add postponement fields to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_postponed boolean DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS postponed_date text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS postponed_location text;

-- Admin announcements table
CREATE TABLE IF NOT EXISTS public.admin_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text,
  image_url text,
  link_url text,
  link_text text,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage announcements" ON public.admin_announcements FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view active announcements" ON public.admin_announcements FOR SELECT TO anon, authenticated USING (is_active = true);

-- Admin advertisements table
CREATE TABLE IF NOT EXISTS public.admin_advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  link_url text,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  guest_info jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_advertisements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage advertisements" ON public.admin_advertisements FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view active ads" ON public.admin_advertisements FOR SELECT TO anon, authenticated USING (is_active = true);

-- Testimonials table
CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  organization text,
  quote text NOT NULL,
  avatar_url text,
  rating integer DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage testimonials" ON public.testimonials FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view active testimonials" ON public.testimonials FOR SELECT TO anon, authenticated USING (is_active = true);

-- Create storage bucket for advertisement images
INSERT INTO storage.buckets (id, name, public) VALUES ('advertisements', 'advertisements', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view ad images
CREATE POLICY "Anyone can view ad images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'advertisements');

-- Allow authenticated admins to upload ad images
CREATE POLICY "Admins can upload ad images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'advertisements' AND public.has_role(auth.uid(), 'admin'));

-- Allow authenticated admins to delete ad images
CREATE POLICY "Admins can delete ad images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'advertisements' AND public.has_role(auth.uid(), 'admin'));

-- Add contact_info and personnel (array) columns to admin_advertisements
ALTER TABLE public.admin_advertisements 
  ADD COLUMN IF NOT EXISTS contact_info jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS personnel jsonb DEFAULT '[]'::jsonb;
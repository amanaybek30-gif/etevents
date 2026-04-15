
-- Subscription payments table for tracking organizer payments with receipts
CREATE TABLE public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL,
  plan text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  addons jsonb DEFAULT '[]'::jsonb,
  transaction_number text,
  receipt_url text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- Organizers can view own payments
CREATE POLICY "Organizers can view own payments"
ON public.subscription_payments FOR SELECT
USING (organizer_id = auth.uid());

-- Organizers can create payments
CREATE POLICY "Organizers can insert own payments"
ON public.subscription_payments FOR INSERT
WITH CHECK (organizer_id = auth.uid());

-- Admins can manage all payments
CREATE POLICY "Admins can manage all subscription payments"
ON public.subscription_payments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for subscription receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('subscription-receipts', 'subscription-receipts', false);

-- Allow organizers to upload receipts
CREATE POLICY "Organizers can upload subscription receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'subscription-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow organizers to view own receipts
CREATE POLICY "Organizers can view own subscription receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'subscription-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow admins to view all subscription receipts
CREATE POLICY "Admins can view all subscription receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'subscription-receipts' AND has_role(auth.uid(), 'admin'::app_role));

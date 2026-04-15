
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS accepted_payment_methods text[] DEFAULT ARRAY['bank_transfer', 'telebirr', 'mpessa']::text[];

ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS payment_info jsonb DEFAULT NULL;

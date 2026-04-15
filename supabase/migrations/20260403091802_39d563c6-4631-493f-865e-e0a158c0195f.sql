-- Add vendor pricing configuration to events
ALTER TABLE public.events
ADD COLUMN vendor_pricing jsonb DEFAULT NULL;

-- Add selected package info to vendor registrations
ALTER TABLE public.vendor_registrations
ADD COLUMN selected_package text DEFAULT NULL,
ADD COLUMN selected_package_price text DEFAULT NULL;
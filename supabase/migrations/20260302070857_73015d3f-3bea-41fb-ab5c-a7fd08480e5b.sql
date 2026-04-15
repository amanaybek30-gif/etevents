
ALTER TABLE public.registrations
ADD COLUMN source text NOT NULL DEFAULT 'platform';

COMMENT ON COLUMN public.registrations.source IS 'Origin of the registration: platform (registered via website) or imported (uploaded by organizer/admin)';

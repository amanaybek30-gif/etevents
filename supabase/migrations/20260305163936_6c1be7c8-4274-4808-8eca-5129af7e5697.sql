
-- Add attendee_type to registrations for categorization (participant, vendor, etc.)
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS attendee_type text NOT NULL DEFAULT 'participant';

-- Add custom_questions to events (JSONB array of question objects)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS custom_questions jsonb DEFAULT NULL;

-- Add custom_answers to registrations (JSONB object of question_id -> answer)
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS custom_answers jsonb DEFAULT NULL;

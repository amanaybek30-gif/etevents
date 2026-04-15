
-- Add subscription_plan to organizer_profiles
ALTER TABLE public.organizer_profiles ADD COLUMN IF NOT EXISTS subscription_plan text NOT NULL DEFAULT 'free';

-- Create surveys table
CREATE TABLE public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  title text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage own surveys" ON public.surveys FOR ALL
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

-- Create survey_responses table
CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  respondent_name text,
  respondent_email text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit survey responses" ON public.survey_responses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Organizers can view survey responses" ON public.survey_responses FOR SELECT
  USING (survey_id IN (SELECT id FROM public.surveys WHERE organizer_id = auth.uid()));

-- Enable realtime for registrations
ALTER PUBLICATION supabase_realtime ADD TABLE public.registrations;

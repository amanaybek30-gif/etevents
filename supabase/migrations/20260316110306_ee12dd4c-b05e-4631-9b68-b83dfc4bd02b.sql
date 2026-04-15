
-- Telegram account linking table
CREATE TABLE public.telegram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  telegram_chat_id bigint NOT NULL UNIQUE,
  telegram_username text,
  role text NOT NULL DEFAULT 'explorer',
  link_token text UNIQUE,
  linked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_accounts ENABLE ROW LEVEL SECURITY;

-- Users can view/update their own telegram account
CREATE POLICY "Users can view own telegram account" ON public.telegram_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own telegram account" ON public.telegram_accounts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own telegram account" ON public.telegram_accounts
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete own telegram account" ON public.telegram_accounts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Admins can manage all
CREATE POLICY "Admins can manage telegram accounts" ON public.telegram_accounts
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Telegram bot state for polling offset
CREATE TABLE public.telegram_bot_state (
  id int PRIMARY KEY CHECK (id = 1),
  update_offset bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;

INSERT INTO public.telegram_bot_state (id, update_offset) VALUES (1, 0);

-- Telegram reminders tracking
CREATE TABLE public.telegram_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid REFERENCES public.registrations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  telegram_chat_id bigint NOT NULL,
  reminder_type text NOT NULL,
  sent_at timestamptz,
  scheduled_for timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reminders" ON public.telegram_reminders
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Telegram announcements from organizers
CREATE TABLE public.telegram_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organizer_id uuid NOT NULL,
  message text NOT NULL,
  sent_count int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can manage own announcements" ON public.telegram_announcements
  FOR ALL TO authenticated USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

CREATE POLICY "Admins can manage all announcements" ON public.telegram_announcements
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast lookups
CREATE INDEX idx_telegram_accounts_user_id ON public.telegram_accounts(user_id);
CREATE INDEX idx_telegram_accounts_chat_id ON public.telegram_accounts(telegram_chat_id);
CREATE INDEX idx_telegram_reminders_scheduled ON public.telegram_reminders(scheduled_for) WHERE sent_at IS NULL;

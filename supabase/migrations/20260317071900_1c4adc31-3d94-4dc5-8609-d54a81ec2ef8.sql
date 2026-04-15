ALTER TABLE public.telegram_accounts
ADD COLUMN IF NOT EXISTS telegram_reminders_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS telegram_updates_enabled boolean NOT NULL DEFAULT false;
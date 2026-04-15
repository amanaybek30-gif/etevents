
-- Make telegram_chat_id nullable so we can create records before the bot links them
ALTER TABLE public.telegram_accounts ALTER COLUMN telegram_chat_id DROP NOT NULL;

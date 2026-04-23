-- Run this in your Supabase SQL editor
-- Safe to re-run — uses IF NOT EXISTS / IF NOT EXISTS guards

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id                uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid    REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  subscription      jsonb   NOT NULL,
  timezone          text    NOT NULL DEFAULT 'Pacific/Auckland',
  notification_hour integer NOT NULL DEFAULT 7,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Add columns to existing table if upgrading from the previous version
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS timezone          text    NOT NULL DEFAULT 'Pacific/Auckland';
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS notification_hour integer NOT NULL DEFAULT 7;

-- Mood check-in prompt columns (added later)
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS mood_prompt_enabled    boolean NOT NULL DEFAULT false;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS mood_prompt_start      integer NOT NULL DEFAULT 9;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS mood_prompt_end        integer NOT NULL DEFAULT 21;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS mood_prompt_today_mins integer;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS mood_prompt_today_date date;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS mood_prompt_last_sent  date;

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own push subscription" ON push_subscriptions;
CREATE POLICY "Users can manage own push subscription"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================
-- MoveUp Migration v10 — Add scheduled_time to tasks
-- Run this in your Supabase SQL editor
-- ============================================================

-- Add the scheduled_time column (optional time-of-day the user plans to start the task)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS scheduled_time TIME;

-- Add last_reminder_sent_at so we can throttle per-task reminder notifications
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP WITH TIME ZONE;

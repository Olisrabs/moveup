-- ============================================================
-- MoveUp Migration v8 — Add Room Reminder Cooldown
-- Run this in your Supabase SQL editor
-- ============================================================

-- Add last_reminder_at column to the rooms table
ALTER TABLE public.rooms 
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamp with time zone;

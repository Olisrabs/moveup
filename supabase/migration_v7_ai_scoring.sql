-- ============================================================
-- MoveUp Migration v7 — AI Task Scoring System
-- Run this in your Supabase SQL Editor.
-- Scores are stored per room (room_members.ai_score).
-- Each task also stores its own AI score + AI reasoning.
-- ============================================================

-- 1. Add score columns to the tasks table
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS score_percentage NUMERIC(7,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS score_breakdown  TEXT          DEFAULT NULL;

-- 2. Add cumulative AI score to the room_members table (per-room, per-user)
--    This means a user in 3 rooms has a separate ai_score for each room.
ALTER TABLE public.room_members
  ADD COLUMN IF NOT EXISTS ai_score NUMERIC(10,2) DEFAULT 0;

-- 3. Expose the new tasks columns to realtime so the Tasks page
--    can update live after the API returns the score.
-- (tasks table is already in the supabase_realtime publication from schema.sql)

-- 4. Allow any authenticated user to read task scores (they are already
--    covered by the existing "Anyone can view tasks" policy).
--    No extra RLS needed for score columns — they live inside tasks/room_members
--    which already have appropriate policies.

-- 5. Allow service-role writes to room_members (for incrementing ai_score).
--    The service role bypasses RLS by default, so no extra policy is required.

-- Done.
-- After running this migration, add GEMINI_API_KEY to your .env.local
-- and Netlify environment variables. See instructions in the project README.

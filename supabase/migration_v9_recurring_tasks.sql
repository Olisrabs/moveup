-- ============================================================
-- MoveUp Migration v9 (Recurring Tasks)
-- ============================================================

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS last_completed_at TIMESTAMP WITH TIME ZONE;

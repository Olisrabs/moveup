-- ============================================================
-- MoveUp Migration v3 — Task Proof Viewing
-- Run this AFTER migration_v2.sql in your Supabase SQL editor
-- ============================================================

-- 1. Add task_id to notifications so we can deep-link to a task's proof
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

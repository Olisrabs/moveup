-- ============================================================
-- MoveUp Migration v14 (Fix Deletion Policies and Cascades)
-- ============================================================
-- This migration enables DELETE operations on rooms, tasks, and proofs
-- for the users who own/created them, which were previously blocked by RLS.
-- ============================================================

-- 1. Enable Delete Policy for Rooms (Only the creator can delete their rooms)
CREATE POLICY "Users can delete their own rooms" ON public.rooms
  FOR DELETE USING (auth.uid() = created_by);

-- 2. Enable Delete Policy for Tasks (Only the user who owns the task can delete it)
CREATE POLICY "Users can delete their own tasks" ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);

-- 3. Enable Delete Policy for Proofs (Only the user who owns the proof can delete it)
CREATE POLICY "Users can delete their own proofs" ON public.proofs
  FOR DELETE USING (auth.uid() = user_id);

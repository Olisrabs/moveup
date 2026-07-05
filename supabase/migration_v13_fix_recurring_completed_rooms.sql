-- ============================================================
-- MoveUp Migration v13 (Fix Recurring Tasks in Completed Rooms)
-- ============================================================
-- One-time cleanup: disable is_recurring on any tasks that belong
-- to a room that has already been marked as completed or has had
-- prizes distributed. These tasks should never auto-reset again.
-- ============================================================

UPDATE public.tasks
SET is_recurring = FALSE
WHERE is_recurring = TRUE
  AND room_id IN (
    SELECT id
    FROM public.rooms
    WHERE status = 'completed'
       OR prize_distributed = TRUE
  );

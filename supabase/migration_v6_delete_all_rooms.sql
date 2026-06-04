-- ============================================================
-- MoveUp Migration v6 — Delete All Rooms
-- Run this in your Supabase SQL Editor to completely delete all rooms.
-- Due to ON DELETE CASCADE on foreign keys, this will also safely delete
-- all associated room memberships, tasks, proofs, and room notifications.
-- ============================================================

DELETE FROM public.rooms;

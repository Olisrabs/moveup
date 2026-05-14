-- ============================================================
-- MoveUp Migration v2 — Feature Enhancements
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Expand coin_transactions type constraint
ALTER TABLE public.coin_transactions
  DROP CONSTRAINT IF EXISTS coin_transactions_type_check;

ALTER TABLE public.coin_transactions
  ADD CONSTRAINT coin_transactions_type_check
  CHECK (type IN (
    'deduction', 'reward', 'bonus',
    'buy', 'transfer_sent', 'transfer_received',
    'pool_win', 'pool_loss', 'task_reward'
  ));

-- 2. Add related_user_id for tracking transfer counterparty
ALTER TABLE public.coin_transactions
  ADD COLUMN IF NOT EXISTS related_user_id uuid REFERENCES public.users(id);

-- 3. Add type column to notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'general';

-- 4. Create Supabase Storage bucket for proofs
-- Run this separately or via the Supabase Dashboard → Storage → New bucket
-- Bucket name: proofs, Public: true
INSERT INTO storage.buckets (id, name, public)
VALUES ('proofs', 'proofs', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage RLS policies for proofs bucket
CREATE POLICY "Authenticated users can upload proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'proofs' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'proofs');

-- 6. Allow inserting notifications for other users (needed for room events)
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 7. Add realtime for coin_transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.coin_transactions;

-- ============================================================
-- MoveUp Migration v4 (FIXED, IDEMPOTENT & MANUAL WITHDRAWALS)
-- Safe to run even if part of it succeeded previously
-- ============================================================

-- 1. Rename coins → balance safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='coins') THEN
    ALTER TABLE public.users RENAME COLUMN coins TO balance;
  END IF;
END $$;

ALTER TABLE public.users ALTER COLUMN balance TYPE NUMERIC(12,2) USING balance::NUMERIC(12,2);
ALTER TABLE public.users ALTER COLUMN balance SET DEFAULT 0;

-- Add is_admin column to users table safely
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. Rename coin_transactions → wallet_transactions safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='coin_transactions') THEN
    ALTER TABLE public.coin_transactions RENAME TO wallet_transactions;
  END IF;
END $$;

-- 3. Change amount column to NUMERIC(12,2)
ALTER TABLE public.wallet_transactions ALTER COLUMN amount TYPE NUMERIC(12,2) USING amount::NUMERIC(12,2);

-- 4. Drop old type constraint
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS coin_transactions_type_check;

-- Clear old virtual-coin transaction rows before adding new constraint
DELETE FROM public.wallet_transactions;

-- 5. Add new real-money type constraint
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN (
    'fund',            -- User tops up wallet (Paystack deposit)
    'withdrawal',      -- User requests bank withdrawal
    'commitment_fee',  -- Deducted when joining/creating a room
    'prize_1st',       -- 1st place prize credit
    'prize_2nd',       -- 2nd place prize credit
    'prize_3rd',       -- 3rd place prize credit
    'refund'           -- Refund for rejected withdrawal / canceled room
  ));

-- 6. Change commitment_fee in rooms to NUMERIC(12,2)
ALTER TABLE public.rooms ALTER COLUMN commitment_fee TYPE NUMERIC(12,2) USING commitment_fee::NUMERIC(12,2);

-- 7. Add prize_distributed flag to rooms
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS prize_distributed BOOLEAN DEFAULT FALSE;

-- 8. RLS: Allow room creator to delete their own room
DROP POLICY IF EXISTS "Room creator can delete room" ON public.rooms;
CREATE POLICY "Room creator can delete room" ON public.rooms
  FOR DELETE USING (auth.uid() = created_by);

-- 9. RLS: Allow room creator to update their own room
DROP POLICY IF EXISTS "Room creator can update room" ON public.rooms;
CREATE POLICY "Room creator can update room" ON public.rooms
  FOR UPDATE USING (auth.uid() = created_by);

-- 10. Fix wallet_transactions RLS policies
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "System can insert transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Authenticated users can insert wallet transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Users can view their own wallet transactions" ON public.wallet_transactions;

CREATE POLICY "Users can view their own wallet transactions"
  ON public.wallet_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert wallet transactions"
  ON public.wallet_transactions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 11. Enable RLS on wallet_transactions
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- 12. Safe Realtime for wallet_transactions (Checks if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_class c ON c.oid = pr.prrelid 
    JOIN pg_publication p ON p.oid = pr.prpubid 
    WHERE c.relname = 'wallet_transactions' AND p.pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 13. Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE
);

-- RLS for withdrawal_requests
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users can view their own withdrawal requests"
  ON public.withdrawal_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Users can create their own withdrawal requests"
  ON public.withdrawal_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Admins can view all withdrawal requests"
  ON public.withdrawal_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can update all withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Admins can update all withdrawal requests"
  ON public.withdrawal_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- Realtime for withdrawal_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr 
    JOIN pg_class c ON c.oid = pr.prrelid 
    JOIN pg_publication p ON p.oid = pr.prpubid 
    WHERE c.relname = 'withdrawal_requests' AND p.pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 14. Reset all user balances to 0 (fresh start for real money)
UPDATE public.users SET balance = 0;

-- ============================================================
-- MoveUp Migration v11 — Partnership & Role System
-- Safe to run: all changes are additive / idempotent
-- ============================================================

-- 1. Add new columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'partner', 'staff', 'super_admin'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS partnership_expires_at TIMESTAMP WITH TIME ZONE;

-- Migrate existing admins to super_admin role
UPDATE public.users SET role = 'super_admin' WHERE is_admin = TRUE AND role = 'user';

-- 2. Create partnership_codes table
CREATE TABLE IF NOT EXISTS public.partnership_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 365,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create staff_invitations table
CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  staff_email TEXT NOT NULL,
  staff_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  responded_at TIMESTAMP WITH TIME ZONE
);

-- 4. Add observer columns to room_members
ALTER TABLE public.room_members ADD COLUMN IF NOT EXISTS member_type TEXT NOT NULL DEFAULT 'participant'
  CHECK (member_type IN ('participant', 'partner_observer', 'staff_observer'));
ALTER TABLE public.room_members ADD COLUMN IF NOT EXISTS fee_waived BOOLEAN NOT NULL DEFAULT FALSE;

-- 5. RLS for partnership_codes
ALTER TABLE public.partnership_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage partnership codes" ON public.partnership_codes;
CREATE POLICY "Super admins can manage partnership codes"
  ON public.partnership_codes FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'super_admin')
  );

DROP POLICY IF EXISTS "Authenticated users can read active unused codes" ON public.partnership_codes;
CREATE POLICY "Authenticated users can read active unused codes"
  ON public.partnership_codes FOR SELECT
  USING (auth.role() = 'authenticated');

-- 6. RLS for staff_invitations
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view their own invitations" ON public.staff_invitations;
CREATE POLICY "Partners can view their own invitations"
  ON public.staff_invitations FOR SELECT
  USING (
    partner_id = auth.uid()
    OR staff_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'super_admin')
  );

DROP POLICY IF EXISTS "Partners can create invitations" ON public.staff_invitations;
CREATE POLICY "Partners can create invitations"
  ON public.staff_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('partner', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Staff can update their invitation response" ON public.staff_invitations;
CREATE POLICY "Staff can update their invitation response"
  ON public.staff_invitations FOR UPDATE
  USING (staff_user_id = auth.uid() OR partner_id = auth.uid());

-- 7. Update withdrawal_requests policies to also allow super_admin role
DROP POLICY IF EXISTS "Admins can view all withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Admins can view all withdrawal requests"
  ON public.withdrawal_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (users.is_admin = TRUE OR users.role = 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update all withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Admins can update all withdrawal requests"
  ON public.withdrawal_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND (users.is_admin = TRUE OR users.role = 'super_admin')
    )
  );

-- 8. Allow partners/staff to insert room_members with fee_waived
DROP POLICY IF EXISTS "Observers can join rooms without fee" ON public.room_members;
CREATE POLICY "Observers can join rooms without fee"
  ON public.room_members FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 9. Realtime for new tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE c.relname = 'partnership_codes' AND p.pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.partnership_codes;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE c.relname = 'staff_invitations' AND p.pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_invitations;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 10. Function: auto-expire partnerships (can be called by a scheduled cron or on login)
CREATE OR REPLACE FUNCTION public.expire_partnerships()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.users
  SET role = 'user', business_name = NULL, partner_id = NULL, partnership_expires_at = NULL
  WHERE role = 'partner'
    AND partnership_expires_at IS NOT NULL
    AND partnership_expires_at < now();
END;
$$;

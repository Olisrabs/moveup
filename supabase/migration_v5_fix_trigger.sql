-- ============================================================
-- MoveUp Migration v5 — Fix User Signup Trigger
-- Run this in your Supabase SQL Editor to resolve the signup error.
-- ============================================================

-- Update the handle_new_user function to use the renamed 'balance' column
-- instead of the old 'coins' column.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, balance)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    0 -- Start new users with 0 balance (real-money era)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

import { createClient } from '@supabase/supabase-js';

// NEXT_PUBLIC_* vars are baked in at build time by Next.js/Netlify.
// Provide safe fallbacks so module evaluation never throws during static
// prerendering (e.g. /_not-found) when the env vars are absent.
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

const supabaseUrl = (() => {
  try { return new URL(rawUrl).origin; } catch { return rawUrl; }
})();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---- Database type stubs ----
export type UserProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  balance: number; // Naira, stored as NUMERIC(12,2)
  is_admin?: boolean;
  created_at: string;
};

export type Room = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  duration_days: number;
  commitment_fee: number; // Naira, stored as NUMERIC(12,2)
  max_members: number | null;
  created_by: string;
  status: 'active' | 'completed';
  created_at: string;
  ends_at: string;
  prize_distributed: boolean;
};

export type RoomMember = {
  id: string;
  room_id: string;
  user_id: string;
  room_display_name: string;
  ai_score: number;   // Cumulative AI score for this user in this room (can exceed 100)
  joined_at: string;
};


export type Task = {
  id: string;
  room_id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: 'pending' | 'completed';
  score_percentage: number | null;  // AI-awarded score for this task (0–100)
  score_breakdown: string | null;   // AI reasoning text
  created_at: string;
};


export type Proof = {
  id: string;
  task_id: string;
  room_id: string;
  user_id: string;
  content_type: 'text' | 'link' | 'image' | 'video' | 'document';
  content_url: string | null;
  content_text: string | null;
  created_at: string;
};

export type WalletTransaction = {
  id: string;
  user_id: string;
  amount: number; // Naira
  type:
    | 'fund'
    | 'withdrawal'
    | 'commitment_fee'
    | 'prize_1st'
    | 'prize_2nd'
    | 'prize_3rd'
    | 'refund';
  description: string | null;
  related_user_id: string | null;
  created_at: string;
};

// Keep CoinTransaction as alias for backwards compatibility during transition
export type CoinTransaction = WalletTransaction;

export type Notification = {
  id: string;
  user_id: string;
  room_id: string | null;
  task_id: string | null;
  message: string;
  is_read: boolean;
  type: string;
  created_at: string;
};

// Task with its associated proofs (from a joined query)
export type TaskWithProof = Task & { proofs: Proof[] };

export type WithdrawalRequest = {
  id: string;
  user_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: 'pending' | 'completed' | 'rejected';
  created_at: string;
  processed_at: string | null;
  users?: {
    display_name: string | null;
    email: string | null;
  } | null;
};

// Formatting helper
export const formatNaira = (amount: number): string =>
  `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

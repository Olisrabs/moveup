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
  coins: number;
  created_at: string;
};

export type Room = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  duration_days: number;
  commitment_fee: number;
  max_members: number | null;
  created_by: string;
  status: 'active' | 'completed';
  created_at: string;
  ends_at: string;
};

export type RoomMember = {
  id: string;
  room_id: string;
  user_id: string;
  room_display_name: string;
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

export type CoinTransaction = {
  id: string;
  user_id: string;
  amount: number;
  type:
    | 'deduction'
    | 'reward'
    | 'bonus'
    | 'buy'
    | 'transfer_sent'
    | 'transfer_received'
    | 'pool_win'
    | 'pool_loss'
    | 'task_reward';
  description: string | null;
  related_user_id: string | null;
  created_at: string;
};

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

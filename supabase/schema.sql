-- User Profile Table
create table public.users (
  id uuid references auth.users(id) not null primary key,
  email text,
  display_name text,
  coins integer default 100,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Rooms Table
create table public.rooms (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  name text not null,
  description text,
  duration_days integer not null,
  commitment_fee integer not null,
  max_members integer,
  created_by uuid references public.users(id) not null,
  status text default 'active' check (status in ('active', 'completed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ends_at timestamp with time zone not null
);

-- Room Members Table
create table public.room_members (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  room_display_name text not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(room_id, user_id)
);

-- Tasks Table
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  title text not null,
  description text,
  due_date timestamp with time zone,
  status text default 'pending' check (status in ('pending', 'completed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Proofs Table
create table public.proofs (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  content_type text not null, -- 'text', 'link', 'image', 'video', 'document'
  content_url text,
  content_text text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Coin Transactions
create table public.coin_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  amount integer not null,
  type text not null, -- 'deduction', 'reward', 'bonus'
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Notifications
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  room_id uuid references public.rooms(id) on delete cascade,
  message text not null,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Realtime Setup
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.proofs;
alter publication supabase_realtime add table public.notifications;

-- Enable Row Level Security (RLS)
alter table public.users enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.tasks enable row level security;
alter table public.proofs enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.notifications enable row level security;

-- Basic Policies (Can be refined further)
create policy "Users can view all users" on public.users for select using (true);
create policy "Users can update their own profile" on public.users for update using (auth.uid() = id);

create policy "Anyone can view active rooms" on public.rooms for select using (true);
create policy "Authenticated users can create rooms" on public.rooms for insert with check (auth.role() = 'authenticated');

create policy "Anyone can view room members" on public.room_members for select using (true);
create policy "Authenticated users can join rooms" on public.room_members for insert with check (auth.role() = 'authenticated');

create policy "Anyone can view tasks" on public.tasks for select using (true);
create policy "Users can insert their own tasks" on public.tasks for insert with check (auth.uid() = user_id);
create policy "Users can update their own tasks" on public.tasks for update using (auth.uid() = user_id);

create policy "Anyone can view proofs" on public.proofs for select using (true);
create policy "Users can insert their own proofs" on public.proofs for insert with check (auth.uid() = user_id);

create policy "Users can view their own transactions" on public.coin_transactions for select using (auth.uid() = user_id);
create policy "System can insert transactions" on public.coin_transactions for insert with check (auth.role() = 'authenticated');

create policy "Users can view their own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Users can update their own notifications" on public.notifications for update using (auth.uid() = user_id);

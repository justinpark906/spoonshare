-- ============================================
-- SpoonShare Phase 4: Caregiver Sync
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Shared access table — caregiver links
create table public.shared_access (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  access_token uuid default gen_random_uuid() not null unique,
  label text not null default 'My Caregiver',
  created_at timestamptz default now()
);

alter table public.shared_access enable row level security;

-- Owner can manage their own links
create policy "Users can view their own shared links"
  on public.shared_access for select
  using (auth.uid() = owner_id);

create policy "Users can create shared links"
  on public.shared_access for insert
  with check (auth.uid() = owner_id);

create policy "Users can delete their own shared links"
  on public.shared_access for delete
  using (auth.uid() = owner_id);

-- Public read by access_token (for caregiver status page — no auth required)
create policy "Anyone can view by access_token"
  on public.shared_access for select
  using (true);

-- 2. Add columns to daily_logs for live spoon tracking and task claims
alter table public.daily_logs
  add column if not exists current_spoons int,
  add column if not exists active_task text,
  add column if not exists claimed_tasks jsonb default '[]'::jsonb;

-- 3. Enable Realtime on daily_logs for caregiver live feed
alter publication supabase_realtime add table public.daily_logs;

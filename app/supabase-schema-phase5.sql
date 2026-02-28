-- ============================================
-- SpoonShare Phase 5: Clinical Reports
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. User notes — free-text "how I feel" journal entries
create table public.user_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  date date not null default current_date,
  created_at timestamptz default now()
);

alter table public.user_notes enable row level security;

create policy "Users can manage their own notes"
  on public.user_notes for all
  using (auth.uid() = user_id);

-- 2. Generated reports — stored for sharing
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  share_token uuid default gen_random_uuid() unique,
  report_data jsonb not null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz default now()
);

alter table public.reports enable row level security;

create policy "Users can view their own reports"
  on public.reports for select
  using (auth.uid() = user_id);

create policy "Users can create reports"
  on public.reports for insert
  with check (auth.uid() = user_id);

-- Public access by share_token (for doctor link)
create policy "Anyone can view shared reports by token"
  on public.reports for select
  using (true);

create index idx_reports_share_token on public.reports (share_token);
create index idx_reports_user on public.reports (user_id, created_at desc);

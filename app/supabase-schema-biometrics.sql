-- =============================================================
-- SpoonShare: Biometrics & Manual Events Schema
-- Features: Health Bridge (HRV tracking) + Spoon Ledger Calendar
-- =============================================================

-- 1. Biometrics table — stores daily wearable/manual health metrics
create table if not exists public.biometrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  hrv_ms int,                -- Heart Rate Variability in milliseconds
  resting_hr int,            -- Resting heart rate in bpm
  sleep_score int,           -- 0-100 scale (raw wearable value)
  source text not null default 'manual',  -- 'manual' | 'apple_watch' | 'oura'
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- RLS for biometrics
alter table public.biometrics enable row level security;

create policy "Users can read own biometrics"
  on public.biometrics for select
  using (auth.uid() = user_id);

create policy "Users can insert own biometrics"
  on public.biometrics for insert
  with check (auth.uid() = user_id);

create policy "Users can update own biometrics"
  on public.biometrics for update
  using (auth.uid() = user_id);

-- 2. Add HRV baseline to profiles
alter table public.profiles
  add column if not exists hrv_baseline float;

-- 3. Add HRV deduction to daily_logs
alter table public.daily_logs
  add column if not exists hrv_deduction int not null default 0;

-- 4. Manual events table — user-logged events for the Spoon Ledger
create table if not exists public.manual_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  spoon_cost int not null check (spoon_cost between 1 and 10),
  category text not null default 'moderate',  -- 'rest' | 'light' | 'moderate' | 'heavy'
  start_time timestamptz not null,
  end_time timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- RLS for manual_events
alter table public.manual_events enable row level security;

create policy "Users can read own manual events"
  on public.manual_events for select
  using (auth.uid() = user_id);

create policy "Users can insert own manual events"
  on public.manual_events for insert
  with check (auth.uid() = user_id);

create policy "Users can update own manual events"
  on public.manual_events for update
  using (auth.uid() = user_id);

create policy "Users can delete own manual events"
  on public.manual_events for delete
  using (auth.uid() = user_id);

-- Index for efficient date-range queries on manual_events
create index if not exists idx_manual_events_user_date
  on public.manual_events (user_id, start_time);

-- Index for efficient biometrics baseline lookups
create index if not exists idx_biometrics_user_date
  on public.biometrics (user_id, date);

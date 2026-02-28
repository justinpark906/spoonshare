-- ============================================
-- SpoonShare Phase 2: Weather & Daily Logs
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Weather logs — stores pressure readings for delta checks
create table public.weather_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  pressure_hpa float not null,
  temperature_c float not null,
  humidity int,
  weather_condition text,
  location text,
  recorded_at timestamptz default now()
);

alter table public.weather_logs enable row level security;

create policy "Users can view their own weather logs"
  on public.weather_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own weather logs"
  on public.weather_logs for insert
  with check (auth.uid() = user_id);

-- Index for efficient delta lookups (last 12h comparison)
create index idx_weather_logs_user_time
  on public.weather_logs (user_id, recorded_at desc);

-- 2. Daily logs — stores each day's calculated spoon budget
create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  starting_spoons int not null,
  baseline_used float not null,
  sleep_score int not null,
  pain_score int not null,
  weather_deduction int not null default 0,
  wearable_sleep_score int,
  deduction_reasons text[] default '{}',
  pressure_hpa float,
  pressure_delta float,
  temperature_c float,
  created_at timestamptz default now(),
  -- One entry per user per day
  unique(user_id, date)
);

alter table public.daily_logs enable row level security;

create policy "Users can view their own daily logs"
  on public.daily_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own daily logs"
  on public.daily_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own daily logs"
  on public.daily_logs for update
  using (auth.uid() = user_id);

create index idx_daily_logs_user_date
  on public.daily_logs (user_id, date desc);

-- ============================================
-- SpoonShare: GARD Disease Database Schema
-- Run after supabase-schema.sql
-- ============================================

-- 1. Create the Disease Reference Table (GARD / HPO)
create table if not exists public.diseases (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  symptoms_raw text,
  hpo_terms text[] default '{}',
  impact_tier int not null default 2 check (impact_tier in (1, 2, 3)),
  gard_url text,
  created_at timestamptz default now()
);

-- 2. Update Profiles to link to a disease
alter table public.profiles
  add column if not exists disease_id uuid references public.diseases(id),
  add column if not exists identified_condition text,
  add column if not exists activity_multiplier float default 1.0,
  add column if not exists impact_tier int check (impact_tier in (1, 2, 3));

-- 3. Index for symptom/disease matching
create index if not exists idx_diseases_hpo_terms on public.diseases using gin (hpo_terms);
create index if not exists idx_diseases_name on public.diseases (name);
create index if not exists idx_profiles_disease_id on public.profiles (disease_id);

-- 4. RLS: diseases is reference data, readable by all authenticated users
alter table public.diseases enable row level security;

create policy "Authenticated users can read diseases"
  on public.diseases for select
  to authenticated
  using (true);

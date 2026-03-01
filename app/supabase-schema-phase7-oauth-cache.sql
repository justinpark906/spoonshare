-- SpoonShare Phase 7: Owner OAuth Token Cache (Caregiver Forecast Parity)

create table if not exists public.owner_oauth_tokens (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  google_provider_token text not null,
  updated_at timestamptz default now() not null
);

alter table public.owner_oauth_tokens enable row level security;

create policy "Users can view own oauth token cache"
  on public.owner_oauth_tokens for select
  using (auth.uid() = owner_id);

create policy "Users can insert own oauth token cache"
  on public.owner_oauth_tokens for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own oauth token cache"
  on public.owner_oauth_tokens for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

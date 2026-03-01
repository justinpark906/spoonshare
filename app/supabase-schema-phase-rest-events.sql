-- ============================================
-- SpoonShare: Rest / Clear Fog events (for transparent budget breakdown)
-- Run this in the Supabase SQL Editor if you want "Clear My Fog" to appear in the calculation.
-- ============================================

alter table public.daily_logs
  add column if not exists rest_events jsonb default '[]'::jsonb;

comment on column public.daily_logs.rest_events is 'Each "Clear My Fog" / rest break: [{ "at": "ISO8601", "spoons": 3 }]';

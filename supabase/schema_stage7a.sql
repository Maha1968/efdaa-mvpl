-- Stage 7A: referral lifecycle events (opens / claims / shares / redeems)
-- Paste into Supabase SQL Editor and Run.

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.tokens (id) on delete cascade,
  event_type text not null
    check (event_type in ('opened', 'claimed', 'shared', 'redeemed', 'rewarded')),
  actor_user_id uuid references public.users (id) on delete set null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists referral_events_token_idx on public.referral_events (token_id);
create index if not exists referral_events_type_idx on public.referral_events (event_type);
create index if not exists referral_events_created_idx on public.referral_events (created_at);

alter table public.referral_events enable row level security;

drop policy if exists "referral_events readable" on public.referral_events;
create policy "referral_events readable" on public.referral_events
  for select to authenticated using (true);

drop policy if exists "referral_events insert" on public.referral_events;
create policy "referral_events insert" on public.referral_events
  for insert to authenticated with check (true);

-- Stage 7E: tag rows for demo seed load/reset
-- Paste into Supabase SQL Editor and Run. Does not touch business logic.

alter table public.users add column if not exists is_demo boolean not null default false;
alter table public.products add column if not exists is_demo boolean not null default false;
alter table public.offers add column if not exists is_demo boolean not null default false;
alter table public.stores add column if not exists is_demo boolean not null default false;
alter table public.tokens add column if not exists is_demo boolean not null default false;
alter table public.purchases add column if not exists is_demo boolean not null default false;
alter table public.rewards add column if not exists is_demo boolean not null default false;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'referral_events'
  ) then
    alter table public.referral_events
      add column if not exists is_demo boolean not null default false;
  end if;
end $$;

create index if not exists users_is_demo_idx on public.users (is_demo) where is_demo;
create index if not exists tokens_is_demo_idx on public.tokens (is_demo) where is_demo;
create index if not exists purchases_is_demo_idx on public.purchases (is_demo) where is_demo;

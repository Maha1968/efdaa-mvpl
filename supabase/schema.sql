-- EFDAA database schema (SPEC.md Section 3)
-- Paste this whole file into the Supabase SQL Editor and click "Run".
-- Safe to re-run: it drops and recreates the EFDAA tables.

-- ---------------------------------------------------------------------------
-- 1. Clean slate (only EFDAA tables; does not touch auth)
-- ---------------------------------------------------------------------------
drop table if exists public.rewards cascade;
drop table if exists public.purchases cascade;
drop table if exists public.tokens cascade;
drop table if exists public.stores cascade;
drop table if exists public.offers cascade;
drop table if exists public.products cascade;
drop table if exists public.users cascade;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- users: one row per signed-in person; id matches Supabase Auth user id.
-- role is permanent once set (see schema_roles.sql for immutability trigger on existing DBs).
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  phone text,
  role text check (role is null or role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12, 2) not null,
  barcode text not null,
  created_at timestamptz not null default now()
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_reward_pct numeric(5, 4) not null,
  created_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

-- tokens: the core of everything, stamped with WHERE and WHEN it was claimed.
create table public.tokens (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  holder_user_id uuid not null references public.users (id) on delete cascade,
  parent_token_id uuid references public.tokens (id) on delete set null,
  root_token_id uuid references public.tokens (id) on delete set null,
  depth integer not null default 0 check (depth >= 0 and depth <= 4),
  product_id uuid not null references public.products (id),
  offer_id uuid not null references public.offers (id),
  scanned_barcode text,
  product_photo_url text,
  barcode_photo_url text,
  claim_lat double precision,
  claim_lng double precision,
  claim_location_text text,
  -- Store the originator recommended from (set on root; copied to children).
  originator_store_id uuid references public.stores (id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index tokens_code_idx on public.tokens (code);
create index tokens_parent_idx on public.tokens (parent_token_id);
create index tokens_root_idx on public.tokens (root_token_id);

-- purchases: the uploaded receipt and the signals computed at validation.
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.tokens (id) on delete cascade,
  buyer_user_id uuid not null references public.users (id) on delete cascade,
  store_id uuid references public.stores (id),
  purchase_lat double precision,
  purchase_lng double precision,
  amount numeric(12, 2) not null,
  receipt_image_url text,
  receipt_barcode text,
  -- Date/time printed on the receipt (purchase duration baseline).
  receipt_purchased_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'validated', 'rejected')),
  barcode_match boolean,
  store_match boolean,
  within_window boolean,
  time_to_purchase_hours numeric(10, 2),
  min_hop_distance_m numeric(12, 2),
  min_hop_time_minutes numeric(12, 2),
  genuineness_score numeric(4, 3) not null default 1.0,
  created_at timestamptz not null default now()
);

create index purchases_token_idx on public.purchases (token_id);
create index purchases_status_idx on public.purchases (status);

-- rewards: one row per person paid on a validated purchase.
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null
    check (role in ('originator', 'forwarder', 'last_referrer', 'buyer')),
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create index rewards_purchase_idx on public.rewards (purchase_id);
create index rewards_user_idx on public.rewards (user_id);

-- ---------------------------------------------------------------------------
-- 3. Auto-create a users row when someone signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    new.phone,
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill any users who already signed up before this trigger existed.
insert into public.users (id, name, phone)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'name', ''),
  u.phone
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security (pilot-simple: signed-in users can use the app)
--    These are intentionally permissive for the pilot; tighten in Phase 1.
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.offers enable row level security;
alter table public.stores enable row level security;
alter table public.tokens enable row level security;
alter table public.purchases enable row level security;
alter table public.rewards enable row level security;

-- users
create policy "users readable by authenticated" on public.users
  for select to authenticated using (true);
create policy "users update own row" on public.users
  for update to authenticated using (auth.uid() = id);
create policy "users insert own row" on public.users
  for insert to authenticated with check (auth.uid() = id);

-- reference data: read for everyone signed in
create policy "products readable" on public.products
  for select to authenticated using (true);
create policy "offers readable" on public.offers
  for select to authenticated using (true);
create policy "stores readable" on public.stores
  for select to authenticated using (true);

-- tokens: signed-in users can read the graph and create/forward tokens
create policy "tokens readable" on public.tokens
  for select to authenticated using (true);
create policy "tokens insert" on public.tokens
  for insert to authenticated with check (true);
create policy "tokens update" on public.tokens
  for update to authenticated using (true);

-- purchases: signed-in users can read and create; validation updates allowed in pilot
create policy "purchases readable" on public.purchases
  for select to authenticated using (true);
create policy "purchases insert" on public.purchases
  for insert to authenticated with check (true);
create policy "purchases update" on public.purchases
  for update to authenticated using (true);

-- rewards: signed-in users can read and write (reward calc runs server-side)
create policy "rewards readable" on public.rewards
  for select to authenticated using (true);
create policy "rewards insert" on public.rewards
  for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- 5. Storage buckets for photos & receipts
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('product-photos', 'product-photos', true),
  ('barcode-photos', 'barcode-photos', true),
  ('receipts', 'receipts', true)
on conflict (id) do nothing;

-- Allow signed-in users to upload, and anyone to view (buckets are public).
drop policy if exists "efdaa uploads" on storage.objects;
create policy "efdaa uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('product-photos', 'barcode-photos', 'receipts'));

drop policy if exists "efdaa public read" on storage.objects;
create policy "efdaa public read" on storage.objects
  for select to public
  using (bucket_id in ('product-photos', 'barcode-photos', 'receipts'));

-- ---------------------------------------------------------------------------
-- 6. Sample data for testing
-- ---------------------------------------------------------------------------
insert into public.products (name, price, barcode) values
  ('Aura Wireless Earbuds', 2499.00, '8901234567890'),
  ('Peak Protein Bar (12-pack)', 799.00, '8909876543210');

insert into public.offers (name, base_reward_pct) values
  ('Launch 5% Reward', 0.0500);

insert into public.stores (name, address, lat, lng) values
  ('Phoenix Marketcity, Chennai', 'Velachery Main Rd, Chennai', 12.9908, 80.2172);

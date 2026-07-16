-- Stage 7J: multi-photo create flow, optional barcode, category + store text
-- Paste into Supabase SQL Editor after schema_stage7h.sql.

-- Recommendation photos (1–5), ordered.
create table if not exists public.token_photos (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.tokens (id) on delete cascade,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists token_photos_token_idx on public.token_photos (token_id);

alter table public.token_photos enable row level security;

drop policy if exists "token_photos readable" on public.token_photos;
create policy "token_photos readable" on public.token_photos
  for select to authenticated using (true);

drop policy if exists "token_photos insert" on public.token_photos;
create policy "token_photos insert" on public.token_photos
  for insert to authenticated with check (true);

-- New token capture fields
alter table public.tokens
  add column if not exists category text;

alter table public.tokens
  add column if not exists store_name_text text;

alter table public.tokens
  add column if not exists store_resolution text;

alter table public.tokens
  add column if not exists store_signage_photo_url text;

-- product_id optional for photo-first recommendations (no catalog pick required)
alter table public.tokens
  alter column product_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tokens_store_resolution_check'
  ) then
    alter table public.tokens
      add constraint tokens_store_resolution_check
      check (
        store_resolution is null
        or store_resolution in ('matched', 'suggested', 'user_entered')
      );
  end if;
end $$;

-- barcode_match: match | mismatch | not_provided (was boolean)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'purchases'
      and column_name = 'barcode_match'
      and data_type = 'boolean'
  ) then
    alter table public.purchases
      alter column barcode_match type text
      using (
        case
          when barcode_match is true then 'match'
          when barcode_match is false then 'mismatch'
          else null
        end
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'purchases_barcode_match_check'
  ) then
    alter table public.purchases
      add constraint purchases_barcode_match_check
      check (
        barcode_match is null
        or barcode_match in ('match', 'mismatch', 'not_provided')
      );
  end if;
end $$;

comment on column public.tokens.category is
  'Inferred or manually chosen product category for the recommendation.';
comment on column public.tokens.store_name_text is
  'Store name when no partner store row was matched.';
comment on column public.tokens.store_resolution is
  'How the store was chosen: matched | suggested | user_entered.';
comment on column public.purchases.barcode_match is
  'match | mismatch | not_provided. not_provided does NOT penalise genuineness.';

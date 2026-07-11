-- Stage 7H: originator store binding + receipt purchase timestamp
-- Paste into Supabase SQL Editor and Run after prior schemas.

-- Partner store the originator recommended from (inherited on the chain).
alter table public.tokens
  add column if not exists originator_store_id uuid references public.stores (id);

create index if not exists tokens_originator_store_idx
  on public.tokens (originator_store_id);

-- Timestamp printed on the receipt/invoice (source of purchase duration).
alter table public.purchases
  add column if not exists receipt_purchased_at timestamptz;

comment on column public.tokens.originator_store_id is
  'Store the originator recommended from; purchase GPS is scored against this store.';
comment on column public.purchases.receipt_purchased_at is
  'Date/time from the purchase receipt; used for time_to_purchase and window checks.';

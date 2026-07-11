-- Stage 7B: permanent user roles (customer | admin) — immutable after set
-- Paste into Supabase SQL Editor and Run.

alter table public.users
  add column if not exists role text
  check (role is null or role in ('customer', 'admin'));

comment on column public.users.role is
  'Permanent app role. Set once on first login; never change customer↔admin.';

-- Prevent role changes after the role has been assigned.
create or replace function public.prevent_user_role_change()
returns trigger
language plpgsql
as $$
begin
  if old.role is not null and new.role is distinct from old.role then
    raise exception 'User role is permanent and cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists users_role_immutable on public.users;
create trigger users_role_immutable
  before update on public.users
  for each row execute function public.prevent_user_role_change();

-- New signups start with role unset (null); the app assigns once on first login.
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

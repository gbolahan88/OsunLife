create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

create unique index if not exists profiles_username_unique
  on public.profiles (username);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
grant select on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

drop policy if exists "Players can read their own profile" on public.profiles;
create policy "Players can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_username text := lower(btrim(new.raw_user_meta_data ->> 'username'));
begin
  if normalized_username is null or normalized_username = '' then
    return new;
  end if;

  if normalized_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Invalid username';
  end if;

  insert into public.profiles (id, username)
  values (new.id, normalized_username);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

insert into public.profiles (id, username)
select
  id,
  lower(btrim(raw_user_meta_data ->> 'username'))
from auth.users
where lower(btrim(raw_user_meta_data ->> 'username')) ~ '^[a-z0-9_]{3,20}$'
on conflict (id) do nothing;
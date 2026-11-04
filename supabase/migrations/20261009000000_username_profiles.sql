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

-- ============================================================
-- Osun Life · step 2: server wallet, payments, spraying, club events
-- Run this whole script once.
-- ============================================================

-- ---------- settings ----------
create table if not exists public.game_settings (
  key text primary key,
  value bigint not null
);
-- Biggest loan a player can take. Set it to at least your LOAN_OFFER in lib/housing.
insert into public.game_settings (key, value) values ('max_loan', 2000000)
on conflict (key) do nothing;
alter table public.game_settings enable row level security;
revoke all on table public.game_settings from anon, authenticated;
grant all on table public.game_settings to service_role;

-- ---------- wallets ----------
create table if not exists public.wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance bigint not null default 10000000 check (balance >= 0),
  version bigint not null default 0,
  furniture_credit bigint not null default 0 check (furniture_credit >= 0),
  loan_taken boolean not null default false,
  last_claim_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.wallets enable row level security;
revoke all on table public.wallets from anon, authenticated;
grant select on table public.wallets to authenticated;
grant all on table public.wallets to service_role;
drop policy if exists "Players read their own wallet" on public.wallets;
create policy "Players read their own wallet" on public.wallets
  for select to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.wallet_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta bigint not null,
  reason text not null,
  ref text,
  balance_after bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists wallet_ledger_user_idx on public.wallet_ledger (user_id, created_at desc);
alter table public.wallet_ledger enable row level security;
revoke all on table public.wallet_ledger from anon, authenticated;
grant select on table public.wallet_ledger to authenticated;
grant all on table public.wallet_ledger to service_role;
drop policy if exists "Players read their own ledger" on public.wallet_ledger;
create policy "Players read their own ledger" on public.wallet_ledger
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------- map tasks (rewards and cooldowns are decided here, not in the browser) ----------
create table if not exists public.map_tasks (
  id text primary key,
  reward bigint not null check (reward > 0),
  cooldown_hours int not null default 24
);
insert into public.map_tasks (id, reward, cooldown_hours) values
  ('market-delivery', 90000, 24),
  ('stadium-setup', 80000, 24),
  ('meal-pickup', 75000, 24),
  ('mall-parcel', 75000, 24),
  ('hospital-supplies', 80000, 24)
on conflict (id) do update set reward = excluded.reward, cooldown_hours = excluded.cooldown_hours;

create table if not exists public.task_claims (
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id text not null references public.map_tasks (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (user_id, task_id)
);
alter table public.map_tasks enable row level security;
alter table public.task_claims enable row level security;
revoke all on table public.map_tasks from anon, authenticated;
revoke all on table public.task_claims from anon, authenticated;
grant all on table public.map_tasks to service_role;
grant all on table public.task_claims to service_role;

-- ---------- club purchases ----------
create table if not exists public.venue_actions (
  id text primary key,
  kind text not null,
  price bigint not null check (price > 0),
  venues text[] not null
);
-- Keep these prices the same as lib/venue.ts. The server price is the one that is charged.
insert into public.venue_actions (id, kind, price, venues) values
  ('spray-5k',    'spray',    5000,    '{zeus-club}'),
  ('spray-100k',  'spray',    100000,  '{zeus-club}'),
  ('spray-1m',    'spray',    1000000, '{zeus-club}'),
  ('hype-man',    'hype',     20000,   '{zeus-club}'),
  ('dj-shoutout', 'dj',       50000,   '{zeus-club}'),
  ('cocktail',    'drink',    10000,   '{zeus-club,berrymist,circle-lounge}'),
  ('bottle-vip',  'bottle',   250000,  '{zeus-club,berrymist,circle-lounge}'),
  ('gold-bottle', 'gold',     1000000, '{zeus-club,berrymist,circle-lounge}'),
  ('round',       'round',    2000000, '{zeus-club,berrymist,circle-lounge}'),
  ('takeover',    'takeover', 8000000, '{zeus-club,berrymist,circle-lounge}')
on conflict (id) do update set kind = excluded.kind, price = excluded.price, venues = excluded.venues;
alter table public.venue_actions enable row level security;
revoke all on table public.venue_actions from anon, authenticated;
grant all on table public.venue_actions to service_role;

create table if not exists public.venue_events (
  id uuid primary key default gen_random_uuid(),
  venue text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null,
  action_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists venue_events_venue_idx on public.venue_events (venue, created_at desc);
alter table public.venue_events enable row level security;
revoke all on table public.venue_events from anon, authenticated;
grant select on table public.venue_events to authenticated;
grant all on table public.venue_events to service_role;
drop policy if exists "Signed-in players see venue events" on public.venue_events;
create policy "Signed-in players see venue events" on public.venue_events
  for select to authenticated using (true);

create table if not exists public.money_drops (
  id uuid primary key default gen_random_uuid(),
  venue text not null,
  sprayer_id uuid not null references auth.users (id) on delete cascade,
  sprayer_username text not null,
  amount bigint not null check (amount > 0),
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  refunded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists money_drops_open_idx on public.money_drops (sprayer_id, created_at)
  where claimed_by is null and not refunded;
alter table public.money_drops enable row level security;
revoke all on table public.money_drops from anon, authenticated;
grant select on table public.money_drops to authenticated;
grant all on table public.money_drops to service_role;
drop policy if exists "Signed-in players see money drops" on public.money_drops;
create policy "Signed-in players see money drops" on public.money_drops
  for select to authenticated using (true);

-- ============================================================
-- Internal helpers (not callable from the browser)
-- ============================================================
create or replace function public.ensure_wallet(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.wallets (user_id) values (p_uid) on conflict (user_id) do nothing;
end;
$$;

-- The one place a balance changes. Refuses to go below zero.
create or replace function public.wallet_apply(p_uid uuid, p_delta bigint, p_reason text, p_ref text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance bigint;
  v_version bigint;
begin
  update public.wallets
     set balance = balance + p_delta,
         version = version + 1,
         updated_at = now()
   where user_id = p_uid and balance + p_delta >= 0
   returning balance, version into v_balance, v_version;

  if not found then
    raise exception 'insufficient_funds';
  end if;

  insert into public.wallet_ledger (user_id, delta, reason, ref, balance_after)
  values (p_uid, p_delta, p_reason, p_ref, v_balance);

  return jsonb_build_object('balance', v_balance, 'version', v_version);
end;
$$;

-- Sprayed notes nobody picked up come back to the sprayer
create or replace function public.sweep_expired_drops(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total bigint;
begin
  with expired as (
    update public.money_drops
       set refunded = true
     where sprayer_id = p_uid
       and claimed_by is null
       and not refunded
       and created_at < now() - interval '30 seconds'
     returning amount
  )
  select coalesce(sum(amount), 0) into v_total from expired;

  if v_total > 0 then
    perform public.wallet_apply(p_uid, v_total, 'drop_refund');
  end if;
end;
$$;

revoke all on function public.ensure_wallet(uuid) from public, anon, authenticated;
revoke all on function public.wallet_apply(uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.sweep_expired_drops(uuid) from public, anon, authenticated;

-- ============================================================
-- Functions the game calls
-- ============================================================
create or replace function public.wallet_get()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_balance bigint;
  v_version bigint;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  perform public.ensure_wallet(v_uid);
  perform public.sweep_expired_drops(v_uid);
  select balance, version into v_balance, v_version from public.wallets where user_id = v_uid;
  return jsonb_build_object('balance', v_balance, 'version', v_version);
end;
$$;

create or replace function public.wallet_spend(p_amount bigint, p_reason text, p_ref text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  if p_reason is null or p_reason not in ('travel', 'rent', 'furniture', 'loan_repay') then
    raise exception 'bad_reason';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000000000000 then
    raise exception 'bad_amount';
  end if;

  perform public.ensure_wallet(v_uid);
  v_result := public.wallet_apply(v_uid, -p_amount, p_reason, p_ref);

  if p_reason = 'furniture' then
    update public.wallets set furniture_credit = furniture_credit + p_amount where user_id = v_uid;
  end if;
  return v_result;
end;
$$;

-- Selling furniture pays 90%, and only up to what the player really spent on furniture
create or replace function public.wallet_refund_furniture(p_price bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  if p_price is null or p_price < 1 or p_price > 1000000000 then raise exception 'bad_amount'; end if;

  perform public.ensure_wallet(v_uid);
  update public.wallets
     set furniture_credit = furniture_credit - p_price
   where user_id = v_uid and furniture_credit >= p_price;
  if not found then raise exception 'no_credit'; end if;

  return public.wallet_apply(v_uid, (p_price * 9) / 10, 'furniture_refund');
end;
$$;

create or replace function public.wallet_take_loan(p_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_max bigint;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  select value into v_max from public.game_settings where key = 'max_loan';
  if p_amount is null or p_amount < 1 or p_amount > coalesce(v_max, 0) then
    raise exception 'bad_loan';
  end if;

  perform public.ensure_wallet(v_uid);
  update public.wallets set loan_taken = true where user_id = v_uid and not loan_taken;
  if not found then raise exception 'loan_taken'; end if;

  return public.wallet_apply(v_uid, p_amount, 'loan');
end;
$$;

create or replace function public.claim_task(p_task text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_task public.map_tasks%rowtype;
  v_claimed timestamptz;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  select * into v_task from public.map_tasks where id = p_task;
  if not found then raise exception 'unknown_task'; end if;

  perform public.ensure_wallet(v_uid);

  insert into public.task_claims as tc (user_id, task_id, claimed_at)
  values (v_uid, p_task, now())
  on conflict (user_id, task_id) do update
    set claimed_at = now()
    where tc.claimed_at <= now() - make_interval(hours => v_task.cooldown_hours)
  returning tc.claimed_at into v_claimed;

  if v_claimed is null then raise exception 'cooldown'; end if;

  return public.wallet_apply(v_uid, v_task.reward, 'task', p_task);
end;
$$;

create or replace function public.send_money(p_recipient uuid, p_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_to text;
  v_result jsonb;
  v_msg public.messages%rowtype;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  if p_recipient is null or p_recipient = v_uid then raise exception 'self_transfer'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000000 then raise exception 'bad_amount'; end if;

  select username into v_to from public.profiles where id = p_recipient;
  if v_to is null then raise exception 'unknown_player'; end if;

  perform public.ensure_wallet(v_uid);
  perform public.ensure_wallet(p_recipient);
  -- Lock both wallets in the same order every time so two players paying each other can't deadlock
  perform 1 from public.wallets where user_id in (v_uid, p_recipient) order by user_id for update;

  v_result := public.wallet_apply(v_uid, -p_amount, 'transfer_out', p_recipient::text);
  perform public.wallet_apply(p_recipient, p_amount, 'transfer_in', v_uid::text);

  insert into public.messages (sender_id, recipient_id, body, kind, amount)
  values (v_uid, p_recipient, 'Sent ₦' || to_char(p_amount, 'FM999,999,999,999'), 'money', p_amount)
  returning * into v_msg;

  return v_result || jsonb_build_object('message', to_jsonb(v_msg));
end;
$$;

create or replace function public.venue_buy(p_venue text, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_action public.venue_actions%rowtype;
  v_username text;
  v_result jsonb;
  v_notes int;
  v_each bigint;
  v_rest bigint;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;

  select * into v_action from public.venue_actions where id = p_action;
  if not found or not (p_venue = any (v_action.venues)) then raise exception 'unknown_action'; end if;

  select username into v_username from public.profiles where id = v_uid;
  if v_username is null then raise exception 'no_profile'; end if;

  perform public.ensure_wallet(v_uid);
  perform public.sweep_expired_drops(v_uid);
  v_result := public.wallet_apply(v_uid, -v_action.price, 'venue', p_action);

  -- Spraying turns the money into notes other players can pick up
  if v_action.kind = 'spray' then
    v_notes := case when v_action.price <= 10000 then 5 when v_action.price <= 200000 then 8 else 12 end;
    v_each := v_action.price / v_notes;
    v_rest := v_action.price - v_each * v_notes;
    for i in 1..v_notes loop
      insert into public.money_drops (venue, sprayer_id, sprayer_username, amount)
      values (p_venue, v_uid, v_username, v_each + case when i = 1 then v_rest else 0 end);
    end loop;
  end if;

  insert into public.venue_events (venue, user_id, username, action_id)
  values (p_venue, v_uid, v_username, p_action);

  return v_result;
end;
$$;

create or replace function public.claim_drop(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_last timestamptz;
  v_amount bigint;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  perform public.ensure_wallet(v_uid);

  -- At most one pick-up every quarter second, so nobody can sweep a room with a script
  select last_claim_at into v_last from public.wallets where user_id = v_uid for update;
  if v_last is not null and clock_timestamp() - v_last < interval '250 milliseconds' then
    raise exception 'too_fast';
  end if;

  update public.money_drops
     set claimed_by = v_uid, claimed_at = now()
   where id = p_id
     and claimed_by is null
     and not refunded
     and sprayer_id <> v_uid
     and created_at > now() - interval '20 seconds'
   returning amount into v_amount;

  if not found then
    if exists (select 1 from public.money_drops where id = p_id and sprayer_id = v_uid) then
      raise exception 'own_drop';
    elsif exists (select 1 from public.money_drops where id = p_id and claimed_by is not null) then
      raise exception 'already_claimed';
    else
      raise exception 'expired';
    end if;
  end if;

  update public.wallets set last_claim_at = clock_timestamp() where user_id = v_uid;
  v_result := public.wallet_apply(v_uid, v_amount, 'drop_claim', p_id::text);
  return v_result || jsonb_build_object('amount', v_amount);
end;
$$;

-- Only signed-in players can call these
revoke all on function public.wallet_get() from public, anon;
revoke all on function public.wallet_spend(bigint, text, text) from public, anon;
revoke all on function public.wallet_refund_furniture(bigint) from public, anon;
revoke all on function public.wallet_take_loan(bigint) from public, anon;
revoke all on function public.claim_task(text) from public, anon;
revoke all on function public.send_money(uuid, bigint) from public, anon;
revoke all on function public.venue_buy(text, text) from public, anon;
revoke all on function public.claim_drop(uuid) from public, anon;
grant execute on function public.wallet_get() to authenticated;
grant execute on function public.wallet_spend(bigint, text, text) to authenticated;
grant execute on function public.wallet_refund_furniture(bigint) to authenticated;
grant execute on function public.wallet_take_loan(bigint) to authenticated;
grant execute on function public.claim_task(text) to authenticated;
grant execute on function public.send_money(uuid, bigint) to authenticated;
grant execute on function public.venue_buy(text, text) to authenticated;
grant execute on function public.claim_drop(uuid) to authenticated;

-- ============================================================
-- Chat: money messages can only be created by send_money
-- ============================================================
alter table public.messages add column if not exists kind text not null default 'text'
  check (kind in ('text', 'money'));
alter table public.messages add column if not exists amount bigint
  check (amount is null or amount > 0);

drop policy if exists "Players send messages as themselves" on public.messages;
create policy "Players send messages as themselves" on public.messages
  for insert to authenticated
  with check ((select auth.uid()) = sender_id and kind = 'text' and amount is null);

-- ============================================================
-- Realtime
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wallets') then
    alter publication supabase_realtime add table public.wallets;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'venue_events') then
    alter publication supabase_realtime add table public.venue_events;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'money_drops') then
    alter publication supabase_realtime add table public.money_drops;
  end if;
end $$;
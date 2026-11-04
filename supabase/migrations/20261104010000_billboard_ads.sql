create table if not exists public.billboard_ads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  board_id text not null check (board_id in (
    'billboard-1', 'billboard-2', 'billboard-3',
    'billboard-4', 'billboard-5', 'billboard-6'
  )),
  ad_type text not null check (ad_type in ('image', 'video')),
  amount_kobo integer not null check (
    (ad_type = 'image' and amount_kobo = 100000) or
    (ad_type = 'video' and amount_kobo = 200000)
  ),
  paystack_reference text not null unique,
  media_path text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'failed')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists billboard_ads_active_idx
  on public.billboard_ads (board_id, created_at)
  where status = 'active';

alter table public.billboard_ads enable row level security;
revoke all on table public.billboard_ads from public, anon, authenticated;
grant all on table public.billboard_ads to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'billboard-ads',
  'billboard-ads',
  true,
  31457280,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view billboard ad media" on storage.objects;
create policy "Public can view billboard ad media"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'billboard-ads');

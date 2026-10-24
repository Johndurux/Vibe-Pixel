-- Vibe Pixel Wall - Phase 2A
-- Paste this whole file into the Supabase SQL Editor.
-- Service-role writes bypass RLS; the browser never receives the service key.

create extension if not exists pgcrypto;

create table if not exists public.slots (
  id uuid primary key default gen_random_uuid(),
  x integer not null check (x >= 0),
  y integer not null check (y >= 0),
  w integer not null check (w > 0),
  h integer not null check (h > 0),
  project_name text not null,
  description text check (description is null or char_length(description) <= 140),
  link text not null,
  logo_url text,
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  contract_address text,
  wallet text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  constraint slots_allowed_size check (
    (w = 3 and h = 3) or (w = 5 and h = 5) or (w = 10 and h = 10)
  ),
  constraint slots_inside_grid check (x + w <= 100 and y + h <= 100),
  constraint slots_no_overlap exclude using gist (
    int4range(x, x + w) with &&,
    int4range(y, y + h) with &&
  ) where (status in ('pending', 'approved')),
  constraint slots_name_len check (char_length(project_name) <= 40),
  constraint slots_name_not_blank check (char_length(btrim(project_name)) > 0),
  constraint slots_link_https check (link ~* '^https://'),
  constraint slots_link_len check (char_length(link) <= 300),
  constraint slots_logo_https check (logo_url is null or logo_url ~* '^https://'),
  constraint slots_contract_fmt check (
    contract_address is null or contract_address ~ '^0x[0-9a-fA-F]{40}$'
  ),
  constraint slots_wallet_fmt check (
    wallet is null or wallet ~ '^0x[0-9a-fA-F]{40}$'
  )
);

create index if not exists slots_status_created_at_idx
  on public.slots (status, created_at desc);

alter table public.slots enable row level security;

-- Public visitors may only read approved slots. There is intentionally no
-- insert/update/delete policy; all writes go through the server route handlers
-- using the service-role key.
drop policy if exists "Public read approved slots" on public.slots;
create policy "Public read approved slots"
  on public.slots
  for select
  using (status = 'approved');

-- DB-backed rate-limit events. Only the service role needs access.
create table if not exists public.slot_submission_events (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists slot_submission_events_ip_created_at_idx
  on public.slot_submission_events (ip_hash, created_at desc);

alter table public.slot_submission_events enable row level security;

-- Public bucket for slot logos. Uploads are performed server-side with the
-- service-role key; the public URL is stored in slots.logo_url.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  204800,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Bucket is public; objects are readable without a policy.
-- The "Public read logos" policy is intentionally not created.
-- Beccas Diaries media studio
-- Separate from the existing posts table.
-- Only explicitly authorised admins can manage media.

create table if not exists public.media_admins (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

alter table public.media_admins enable row level security;

revoke all on table public.media_admins from public, anon, authenticated;

create or replace function public.is_media_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.media_admins
        where user_id = (select auth.uid())
    );
$$;

revoke all on function public.is_media_admin() from public;
grant execute on function public.is_media_admin() to anon, authenticated;

create table if not exists public.media_slots (
    id uuid primary key default gen_random_uuid(),
    media_type text not null check (media_type in ('video','audio')),
    slot_number integer not null check (slot_number between 1 and 10),
    title text not null,
    description text not null default '',
    social_url text,
    object_key text not null unique,
    mime_type text not null,
    size_bytes bigint not null check (size_bytes > 0),
    duration_seconds integer not null check (duration_seconds between 1 and 300),
    status text not null default 'draft' check (status in ('draft','published')),
    author_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (media_type, slot_number)
);

alter table public.media_slots enable row level security;

drop policy if exists "Public can read published media" on public.media_slots;
drop policy if exists "Authors can create their own media" on public.media_slots;
drop policy if exists "Authors can update their own media" on public.media_slots;
drop policy if exists "Authors can delete their own media" on public.media_slots;
drop policy if exists "Admins can create media" on public.media_slots;
drop policy if exists "Admins can update media" on public.media_slots;
drop policy if exists "Admins can delete media" on public.media_slots;

create policy "Public can read published media"
on public.media_slots
for select
using (
    status = 'published'
    or (select public.is_media_admin())
);

create policy "Admins can create media"
on public.media_slots
for insert
to authenticated
with check (
    (select public.is_media_admin())
    and author_id = (select auth.uid())
);

create policy "Admins can update media"
on public.media_slots
for update
to authenticated
using (
    (select public.is_media_admin())
    and author_id = (select auth.uid())
)
with check (
    (select public.is_media_admin())
    and author_id = (select auth.uid())
);

create policy "Admins can delete media"
on public.media_slots
for delete
to authenticated
using (
    (select public.is_media_admin())
    and author_id = (select auth.uid())
);

grant select on public.media_slots to anon, authenticated;
grant insert, update, delete on public.media_slots to authenticated;

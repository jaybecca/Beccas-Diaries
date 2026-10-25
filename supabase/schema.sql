-- Faith & Light CMS schema (run in Supabase SQL Editor)
-- Use a Supabase project with email/password authentication enabled.
create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category_id text not null,
  subcategory text default '',
  excerpt text default '',
  body text not null default '',
  scripture text default '',
  reading_time integer not null default 3 check (reading_time between 1 and 30),
  color text not null default 'lavender',
  status text not null default 'draft' check (status in ('draft','published')),
  slot_number integer unique check (slot_number between 1 and 100),
  author_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts enable row level security;

-- Public visitors can only read published posts.
drop policy if exists "Anyone can read published posts" on public.posts;
create policy "Anyone can read published posts"
on public.posts for select
using (status = 'published' or auth.uid() = author_id);

-- Authenticated authors can create their own posts.
drop policy if exists "Authors can create posts" on public.posts;
create policy "Authors can create posts"
on public.posts for insert to authenticated
with check (auth.uid() = author_id);

drop policy if exists "Authors can update their own posts" on public.posts;
create policy "Authors can update their own posts"
on public.posts for update to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "Authors can delete their own posts" on public.posts;
create policy "Authors can delete their own posts"
on public.posts for delete to authenticated
using (auth.uid() = author_id);

-- Create your admin user in Supabase Authentication > Users.
-- IMPORTANT: Disable public sign-ups in Supabase Auth settings if only you should administer the site.
-- The public frontend only uses the anon/publishable key; never expose a service_role key.

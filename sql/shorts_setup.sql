-- STAFFORD SISTERS SHORTS (family-only)
-- Run in the Stafford Sisters Supabase project SQL Editor, as project owner.
-- Safe to rerun. Does not modify or delete existing Loop, Kitchen, or Teacher data.

create table if not exists public.shorts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 1200),
  media_path text not null unique,
  media_type text not null check (media_type in ('image','video')),
  music_track text not null default 'none' check (music_track in ('none','sunshine','starlight','cozy')),
  created_at timestamptz not null default now()
);
create index if not exists shorts_recent_idx on public.shorts (created_at desc);

create table if not exists public.shorts_reactions (
  id uuid primary key default gen_random_uuid(),
  short_id uuid not null references public.shorts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('like','heart')),
  created_at timestamptz not null default now(),
  unique(short_id,user_id)
);
create index if not exists shorts_reactions_short_idx on public.shorts_reactions(short_id);

create table if not exists public.shorts_comments (
  id uuid primary key default gen_random_uuid(),
  short_id uuid not null references public.shorts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists shorts_comments_short_idx on public.shorts_comments(short_id,created_at);

alter table public.shorts enable row level security;
alter table public.shorts_reactions enable row level security;
alter table public.shorts_comments enable row level security;

-- A signed-in family member has a profile. Outsiders cannot browse or post.
drop policy if exists "shorts_family_select" on public.shorts;
create policy "shorts_family_select" on public.shorts for select to authenticated
 using (exists(select 1 from public.family_profiles fp where fp.user_id=auth.uid()));
drop policy if exists "shorts_owner_insert" on public.shorts;
create policy "shorts_owner_insert" on public.shorts for insert to authenticated
 with check (user_id=auth.uid() and exists(select 1 from public.family_profiles fp where fp.user_id=auth.uid()));
drop policy if exists "shorts_owner_delete" on public.shorts;
create policy "shorts_owner_delete" on public.shorts for delete to authenticated
 using (user_id=auth.uid());
drop policy if exists "shorts_owner_update" on public.shorts;
create policy "shorts_owner_update" on public.shorts for update to authenticated
 using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists "shorts_reactions_family_select" on public.shorts_reactions;
create policy "shorts_reactions_family_select" on public.shorts_reactions for select to authenticated
 using (exists(select 1 from public.family_profiles fp where fp.user_id=auth.uid()));
drop policy if exists "shorts_reactions_owner_insert" on public.shorts_reactions;
create policy "shorts_reactions_owner_insert" on public.shorts_reactions for insert to authenticated
 with check (user_id=auth.uid() and exists(select 1 from public.family_profiles fp where fp.user_id=auth.uid()));
drop policy if exists "shorts_reactions_owner_update" on public.shorts_reactions;
create policy "shorts_reactions_owner_update" on public.shorts_reactions for update to authenticated
 using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists "shorts_reactions_owner_delete" on public.shorts_reactions;
create policy "shorts_reactions_owner_delete" on public.shorts_reactions for delete to authenticated
 using (user_id=auth.uid());

drop policy if exists "shorts_comments_family_select" on public.shorts_comments;
create policy "shorts_comments_family_select" on public.shorts_comments for select to authenticated
 using (exists(select 1 from public.family_profiles fp where fp.user_id=auth.uid()));
drop policy if exists "shorts_comments_owner_insert" on public.shorts_comments;
create policy "shorts_comments_owner_insert" on public.shorts_comments for insert to authenticated
 with check (user_id=auth.uid() and exists(select 1 from public.family_profiles fp where fp.user_id=auth.uid()));
drop policy if exists "shorts_comments_owner_delete" on public.shorts_comments;
create policy "shorts_comments_owner_delete" on public.shorts_comments for delete to authenticated
 using (user_id=auth.uid());

-- Private media; uploads must live under the uploader's auth user UUID.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('shorts-media','shorts-media',false,52428800,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','video/webm'])
on conflict (id) do nothing;

drop policy if exists "shorts_media_family_read" on storage.objects;
create policy "shorts_media_family_read" on storage.objects for select to authenticated
 using (bucket_id='shorts-media'
  and exists(select 1 from public.family_profiles fp where fp.user_id=auth.uid()));
drop policy if exists "shorts_media_owner_upload" on storage.objects;
create policy "shorts_media_owner_upload" on storage.objects for insert to authenticated
 with check (bucket_id='shorts-media'
  and (storage.foldername(name))[1]=auth.uid()::text
  and exists(select 1 from public.family_profiles fp where fp.user_id=auth.uid()));
drop policy if exists "shorts_media_owner_delete" on storage.objects;
create policy "shorts_media_owner_delete" on storage.objects for delete to authenticated
 using (bucket_id='shorts-media' and (storage.foldername(name))[1]=auth.uid()::text);

-- Stafford Sisters Shorts: fix "permission denied for table shorts".
-- Run this in the Stafford Sisters Supabase SQL Editor as the project owner.
-- Row-level security policies already restrict access to signed-in family members.
-- These grants allow the authenticated role to use those existing policies.
-- Safe to rerun; no posts, pictures, or accounts are changed.

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shorts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shorts_reactions TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.shorts_comments TO authenticated;

-- Run once in the Stafford Sisters Supabase SQL Editor.
create table if not exists public.push_subscriptions (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique,
 subscription jsonb not null,
 created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
-- Only the server's service role can manage push endpoints.

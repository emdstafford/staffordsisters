-- Stafford Sisters: persistent family notifications and iPhone push support
-- Run in the Stafford Sisters Supabase SQL Editor as the project owner.
-- Safe to rerun; does not remove Loop, Kitchen, Teacher, Shorts, or existing profiles.

create table if not exists public.family_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  loop boolean not null default true,
  projects boolean not null default true,
  kitchen boolean not null default true,
  teacher boolean not null default true,
  shorts boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.family_notification_preferences enable row level security;

drop policy if exists "family_prefs_select_own" on public.family_notification_preferences;
create policy "family_prefs_select_own" on public.family_notification_preferences
for select to authenticated using (user_id=auth.uid());
drop policy if exists "family_prefs_insert_own" on public.family_notification_preferences;
create policy "family_prefs_insert_own" on public.family_notification_preferences
for insert to authenticated
with check (user_id=auth.uid() and exists (select 1 from public.family_profiles fp where fp.user_id=auth.uid()));
drop policy if exists "family_prefs_update_own" on public.family_notification_preferences;
create policy "family_prefs_update_own" on public.family_notification_preferences
for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
revoke all on public.family_notification_preferences from anon;
grant select,insert on public.family_notification_preferences to authenticated;
revoke update on public.family_notification_preferences from authenticated;
grant update(loop,projects,kitchen,teacher,shorts,updated_at) on public.family_notification_preferences to authenticated;

create table if not exists public.family_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('loop','projects','kitchen','teacher','shorts')),
  event_key text not null,
  item_id uuid not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_sent_at timestamptz,
  reminder_sent_at timestamptz,
  unique (recipient_id,event_key)
);
create index if not exists family_notifications_unread_idx
  on public.family_notifications(recipient_id,created_at desc) where read_at is null;
create index if not exists family_notifications_push_idx
  on public.family_notifications(created_at) where push_sent_at is null;
alter table public.family_notifications enable row level security;

drop policy if exists "family_notifications_read_own" on public.family_notifications;
create policy "family_notifications_read_own" on public.family_notifications
for select to authenticated using (recipient_id=auth.uid());
drop policy if exists "family_notifications_mark_own" on public.family_notifications;
create policy "family_notifications_mark_own" on public.family_notifications
for update to authenticated using (recipient_id=auth.uid()) with check (recipient_id=auth.uid());
revoke all on public.family_notifications from anon,authenticated;
grant select on public.family_notifications to authenticated;
grant update(read_at) on public.family_notifications to authenticated;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
-- The server uses the Supabase service role for subscription management. Do not expose device keys publicly.
revoke all on public.push_subscriptions from anon,authenticated;

-- Enqueue notifications at the database so inserts from every page are recorded,
-- even if the author's app closes before it can call the push server.
create or replace function public.stafford_enqueue_notification()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid;
  v_owner uuid;
  v_parent uuid;
  v_item uuid;
  v_category text;
  v_message text;
  v_event text;
  v_all boolean := false;
begin
  if tg_op = 'UPDATE' and to_jsonb(new)->>'reaction' is not distinct from to_jsonb(old)->>'reaction' then
    return new;
  end if;
  v_actor := new.user_id;
  v_event := tg_table_name || ':' || new.id::text;
  if tg_table_name = 'loop_posts' then
    v_item := new.id;
    v_category := case when new.body like '🎨 CRAFT PROJECT:%' then 'projects' else 'loop' end;
    v_message := case when v_category='projects' then 'Someone shared a craft project.' else 'Someone posted in The Loop.' end;
    v_all := true;
  elsif tg_table_name = 'kitchen_recipes' then
    v_item := new.id; v_category := 'kitchen'; v_message := 'A new recipe was shared.'; v_all := true;
  elsif tg_table_name = 'teacher_resources' then
    v_item := new.id; v_category := 'teacher'; v_message := 'A new Teacher Corner resource was shared.'; v_all := true;
  elsif tg_table_name = 'shorts' then
    v_item := new.id; v_category := 'shorts'; v_message := 'A new family Short was shared.'; v_all := true;
  elsif tg_table_name in ('loop_comments','loop_reactions') then
    v_parent := new.post_id; v_item := v_parent;
    select user_id into v_owner from public.loop_posts where id=v_parent;
    v_category := 'loop';
    v_message := case when tg_table_name='loop_comments' then 'Someone commented on your Loop post.' else 'Someone reacted to your Loop post.' end;
  elsif tg_table_name in ('kitchen_comments','kitchen_ratings') then
    v_parent := new.recipe_id; v_item := v_parent;
    select user_id into v_owner from public.kitchen_recipes where id=v_parent;
    v_category := 'kitchen';
    v_message := case when tg_table_name='kitchen_comments' then 'Someone commented on your recipe.' else 'Someone rated your recipe.' end;
  elsif tg_table_name in ('teacher_comments','teacher_reactions') then
    v_parent := new.resource_id; v_item := v_parent;
    select user_id into v_owner from public.teacher_resources where id=v_parent;
    v_category := 'teacher';
    v_message := case when tg_table_name='teacher_comments' then 'Someone commented on your Teacher Corner resource.' else 'Someone reacted to your Teacher Corner resource.' end;
  elsif tg_table_name in ('shorts_comments','shorts_reactions') then
    v_parent := new.short_id; v_item := v_parent;
    select user_id into v_owner from public.shorts where id=v_parent;
    v_category := 'shorts';
    v_message := case when tg_table_name='shorts_comments' then 'Someone commented on your Short.' else 'Someone reacted to your Short.' end;
  else
    return new;
  end if;

  if v_all then
    insert into public.family_notifications(recipient_id,actor_id,category,event_key,item_id,message)
    select fp.user_id,v_actor,v_category,v_event,v_item,v_message
    from public.family_profiles fp
    left join public.family_notification_preferences p on p.user_id=fp.user_id
    where fp.user_id <> v_actor
    and case v_category when 'loop' then coalesce(p.loop,true)
      when 'projects' then coalesce(p.projects,true)
      when 'kitchen' then coalesce(p.kitchen,true)
      when 'teacher' then coalesce(p.teacher,true)
      when 'shorts' then coalesce(p.shorts,true) else false end
    on conflict (recipient_id,event_key) do nothing;
  elsif v_owner is not null and v_owner <> v_actor then
    insert into public.family_notifications(recipient_id,actor_id,category,event_key,item_id,message)
    select v_owner,v_actor,v_category,v_event,v_item,v_message
    where not exists (
      select 1 from public.family_notification_preferences p
      where p.user_id=v_owner and not (
        case v_category when 'loop' then p.loop when 'kitchen' then p.kitchen
          when 'teacher' then p.teacher when 'shorts' then p.shorts else false end))
    on conflict (recipient_id,event_key) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.stafford_enqueue_notification() from public,anon,authenticated;

-- Install triggers only when their source tables exist, so Shorts can be enabled later.
do $$
declare
  t text;
begin
  foreach t in array array[
    'loop_posts','loop_comments','loop_reactions',
    'kitchen_recipes','kitchen_comments','kitchen_ratings',
    'teacher_resources','teacher_comments','teacher_reactions',
    'shorts','shorts_comments','shorts_reactions'
  ] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists stafford_notifications_ai on public.%I',t);
      execute format('create trigger stafford_notifications_ai after insert on public.%I for each row execute function public.stafford_enqueue_notification()',t);
    end if;
  end loop;
  -- Reactions changing from like to heart should generate a new notification.
  foreach t in array array['loop_reactions','teacher_reactions','shorts_reactions'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists stafford_notifications_au on public.%I',t);
      execute format('create trigger stafford_notifications_au after update of reaction on public.%I for each row execute function public.stafford_enqueue_notification()',t);
    end if;
  end loop;
end $$;

-- Recent read notifications are kept for 7 days; the server's daily job
-- cleans them up and reminds each user once about overdue unread items.

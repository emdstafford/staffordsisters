-- Stafford Sisters: shared, editable family profile biographies.
-- Run once in the existing Supabase project's SQL Editor as the project owner.
-- Preserves all existing family_profiles rows and RLS policies.
alter table public.family_profiles
  add column if not exists bio text not null default '';

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.family_profiles'::regclass
       and conname = 'family_profiles_bio_length_check'
  ) then
    alter table public.family_profiles
      add constraint family_profiles_bio_length_check
      check (char_length(bio) <= 300);
  end if;
end
$$;

comment on column public.family_profiles.bio
  is 'Family-only About Me text, edited by the profile owner under existing family_profiles RLS policies.';

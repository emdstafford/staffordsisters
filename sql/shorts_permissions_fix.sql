-- Stafford Sisters Shorts: fix "permission denied for table shorts".
-- Run this in the Stafford Sisters Supabase SQL Editor as the project owner.
-- Row-level security policies already restrict access to signed-in family members.
-- These grants allow the authenticated role to use those existing policies.
-- Safe to rerun; no posts, pictures, or accounts are changed.

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shorts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shorts_reactions TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.shorts_comments TO authenticated;

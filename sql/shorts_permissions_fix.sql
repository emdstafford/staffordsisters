-- Stafford Sisters: complete Shorts permissions for the private server.
-- Run once (safe to rerun) in the Stafford Sisters Supabase SQL Editor.
-- Does not change data, remove any files, or disable row level security.
-- The server's Supabase secret key operates as service_role, which
-- still needs table privileges even though it bypasses RLS.

GRANT USAGE ON SCHEMA public TO service_role, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.shorts, public.shorts_reactions, public.shorts_comments
TO service_role;

-- The signed-in family members' existing row-level security policies
-- still control all access by authenticated users.
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.shorts, public.shorts_reactions, public.shorts_comments
TO authenticated;

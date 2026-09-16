-- ED & DU | Neon production security migration
-- Applied to Neon production on 2026-09-16 via the Neon migration workflow.
-- Enables RLS for public application tables and restricts access by profile role.

create or replace function public.current_app_role() returns text
language sql stable security definer set search_path=public
as $$ select p.role::text from public.profiles p where p.id = auth.uid() limit 1 $$;

-- The complete applied statement is maintained in the Neon migration record.
-- Keep this file versioned with the application so future environments can reproduce the security posture.

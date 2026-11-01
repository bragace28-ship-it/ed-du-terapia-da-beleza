-- ED & DU Master V46 — Auth/RLS hardening
-- Apply only after authenticated Neon E2E has passed in an isolated branch.
-- This migration intentionally does NOT seed users or PIN credentials.
-- PIN hashes are accessible only through SECURITY DEFINER RPCs; direct table
-- access by PUBLIC/anon/authenticated is denied.

begin;

-- Application user directory: users may read their own row; admins may manage
-- the directory. Writes by non-admin users are deliberately denied.
alter table public.app_users enable row level security;

drop policy if exists app_users_admin_manage on public.app_users;
drop policy if exists app_users_self_read on public.app_users;

create policy app_users_admin_manage
  on public.app_users
  for all
  to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy app_users_self_read
  on public.app_users
  for select
  to authenticated
  using (auth_user_id = auth.user_id());

grant select, insert, update, delete on table public.app_users to authenticated;

-- PIN credentials must never be readable or writable through the Data API.
-- The three SECURITY DEFINER RPCs below are the only supported interface.
alter table public.finance_pin_credentials enable row level security;

drop policy if exists finance_pin_credentials_self on public.finance_pin_credentials;

revoke all privileges on table public.finance_pin_credentials
  from public, anon, authenticated;

revoke all privileges on function public.finance_pin_status() from public;
revoke all privileges on function public.set_finance_pin(text) from public;
revoke all privileges on function public.verify_finance_pin(text) from public;
revoke all privileges on function public.current_app_role() from public;

grant execute on function public.finance_pin_status() to authenticated;
grant execute on function public.set_finance_pin(text) to authenticated;
grant execute on function public.verify_finance_pin(text) to authenticated;
grant execute on function public.current_app_role() to authenticated;

commit;

-- Post-deployment verification (run separately as database owner):
-- 1) app_users and finance_pin_credentials must have relrowsecurity = true.
-- 2) app_users must have exactly the two policies defined above.
-- 3) finance_pin_credentials must have zero policies and no table grants
--    for PUBLIC, anon or authenticated.
-- 4) all three PIN RPCs must be SECURITY DEFINER and EXECUTE granted to
--    authenticated; none may be executable by PUBLIC.

-- ED & DU security hardening
-- Safe to apply after the existing application migrations.
-- This migration deliberately does not grant broad new privileges.

BEGIN;

-- Webhook/provider event ledgers are backend-only. RLS remains deny-by-default,
-- and these explicit revokes prevent accidental direct client access if a policy
-- is introduced later.
REVOKE ALL ON TABLE public.pagbank_webhook_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.payment_provider_events FROM anon, authenticated;

-- SECURITY DEFINER RPCs that were previously executable by anon must require an
-- authenticated session. We revoke only the flagged routines by name, across
-- every overload, so this remains compatible with the current signatures.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'calculate_payment_quote',
        'get_command_center',
        'get_command_center_v2',
        'protect_profile_role_changes',
        'set_command_payment_gateway'
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon',
      r.schema_name, r.function_name, r.args
    );
  END LOOP;
END $$;

-- Lock the search path of the known mutable-search-path routines. Using pg_proc
-- metadata avoids guessing their argument signatures.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('set_pix_updated_at', 'simulate_payment_gateways')
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_catalog',
      r.schema_name, r.function_name, r.args
    );
  END LOOP;
END $$;

COMMIT;

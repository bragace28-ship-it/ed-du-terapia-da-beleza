-- Master V46 payment settlement ledger idempotency
-- Apply to the isolated Neon homologation branch first; production remains untouched.
create unique index if not exists financial_transactions_payment_id_uidx
  on public.financial_transactions ((metadata->>'payment_id'))
  where metadata ? 'payment_id';

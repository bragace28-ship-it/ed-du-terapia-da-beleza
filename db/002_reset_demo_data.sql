-- ED & DU production reset: removes demo/test transactions while preserving configuration/catalog data.
-- Run only against the intended Neon production branch after an explicit backup/confirmation.
-- Preserved: coupons, services, gift_cards, app_settings.
-- Users are NOT seeded here because Neon Auth identities require the final email addresses.

begin;

truncate table
  audit_logs,
  account_actions,
  loyalty_transactions,
  loyalty_accounts,
  credit_alerts,
  credit_accounts,
  recurring_payments,
  ocr_documents,
  finance_pin_credentials,
  notifications,
  push_subscriptions,
  terms,
  anamneses,
  before_after_gallery,
  open_finance_connections,
  commissions,
  receivable_installments,
  receivables,
  payables,
  card_invoices,
  payments,
  command_items,
  commands,
  appointments,
  agenda_blocks,
  quotes,
  referrals,
  clients,
  professionals,
  app_users
restart identity cascade;

update coupons set usage_count=0;
-- services, gift_cards and app_settings intentionally remain untouched.

commit;

alter table public.payment_transactions add column if not exists idempotency_key text;
create unique index if not exists payment_transactions_gateway_idempotency_key on public.payment_transactions(gateway,idempotency_key) where idempotency_key is not null;
alter table public.command_payments add column if not exists idempotency_key text;
create unique index if not exists command_payments_gateway_idempotency_key on public.command_payments(gateway,idempotency_key) where idempotency_key is not null;

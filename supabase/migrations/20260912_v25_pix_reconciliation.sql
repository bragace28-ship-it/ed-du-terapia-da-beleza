-- V25: PIX intents + bank transaction reconciliation primitives.
create table if not exists public.pix_payment_intents (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null references public.commands(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  provider text not null default 'pix',
  provider_payment_id text,
  txid text,
  e2e_id text,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','paid','failed','expired','cancelled')),
  qr_code text,
  copy_paste text,
  expires_at timestamptz,
  paid_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pix_payment_intents_command_idx on public.pix_payment_intents(command_id);
create index if not exists pix_payment_intents_txid_idx on public.pix_payment_intents(txid);
create index if not exists pix_payment_intents_e2e_idx on public.pix_payment_intents(e2e_id);

alter table public.pix_payment_intents enable row level security;

-- Bank feed is intentionally provider-neutral. A real Open Finance connector can populate it later.
alter table public.bank_transactions add column if not exists reconciliation_status text default 'unmatched';
alter table public.bank_transactions add column if not exists command_payment_id uuid references public.command_payments(id) on delete set null;
alter table public.bank_transactions add column if not exists pix_e2e_id text;
create index if not exists bank_transactions_e2e_idx on public.bank_transactions(pix_e2e_id);
create index if not exists bank_transactions_reconciliation_idx on public.bank_transactions(reconciliation_status);

-- Keep timestamps current when rows are updated.
create or replace function public.set_pix_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists pix_payment_intents_updated_at on public.pix_payment_intents;
create trigger pix_payment_intents_updated_at before update on public.pix_payment_intents for each row execute function public.set_pix_updated_at();

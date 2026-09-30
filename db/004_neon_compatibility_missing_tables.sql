-- Additive compatibility layer for the existing Neon production schema.
-- Does not drop/alter existing application tables.
-- Intended to be applied only after validation on a Neon branch.

create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text unique,
  name text not null,
  email text not null unique,
  role text not null check (role in ('admin','professional','client')),
  status text not null default 'Ativo' check (status in ('Ativo','Inativo','Bloqueado')),
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percent','fixed','service')),
  value numeric(12,2) not null default 0,
  service_id uuid references services(id) on delete set null,
  active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit integer,
  usage_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agenda_blocks (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid references professionals(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  command_id uuid references commands(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  amount numeric(12,2) not null default 0,
  method text not null,
  gateway text,
  brand text,
  installments integer not null default 1,
  status text not null default 'Pendente',
  external_id text,
  idempotency_key text unique,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists receivables (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  command_id uuid references commands(id) on delete set null,
  description text,
  total_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  due_at date,
  status text not null default 'Em aberto',
  method text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists receivable_installments (
  id uuid primary key default gen_random_uuid(),
  receivable_id uuid not null references receivables(id) on delete cascade,
  installment_no integer not null,
  amount numeric(12,2) not null default 0,
  due_at date,
  paid_at timestamptz,
  status text not null default 'Em aberto',
  unique (receivable_id, installment_no)
);

create table if not exists payables (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  supplier text,
  amount numeric(12,2) not null default 0,
  due_at date,
  paid_at timestamptz,
  status text not null default 'Aberta',
  category text,
  card_invoice boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists card_invoices (
  id uuid primary key default gen_random_uuid(),
  card_name text not null,
  amount numeric(12,2) not null default 0,
  due_at date,
  category text,
  status text not null default 'Aberta',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists commissions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid references professionals(id) on delete set null,
  command_id uuid references commands(id) on delete set null,
  base_amount numeric(12,2) not null default 0,
  commission_rate numeric(7,4) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  status text not null default 'Pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  professional_id uuid references professionals(id) on delete set null,
  total_amount numeric(12,2) not null default 0,
  status text not null default 'Aberto',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists gift_cards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  value numeric(12,2),
  status text not null default 'Disponível',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_client_id uuid references clients(id) on delete set null,
  referred_name text not null,
  referred_phone text,
  gift_card_id uuid references gift_cards(id) on delete set null,
  status text not null default 'Pendente',
  points_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists terms (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  status text not null default 'Pendente de assinatura',
  sent_at timestamptz,
  signed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists anamneses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  objective text,
  analysis text,
  private_formula text,
  private_notes text,
  files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists before_after_gallery (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  title text,
  caption text,
  before_ref text,
  after_ref text,
  collage_ref text,
  created_at timestamptz not null default now()
);

create table if not exists open_finance_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null default 'disconnected',
  external_account_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references clients(id) on delete cascade,
  points_balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  loyalty_account_id uuid not null references loyalty_accounts(id) on delete cascade,
  points integer not null,
  reason text not null,
  referral_id uuid references referrals(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists credit_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references clients(id) on delete cascade,
  credit_limit numeric(12,2) not null default 0,
  balance numeric(12,2) not null default 0,
  status text not null default 'Ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists credit_alerts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  type text not null,
  message text not null,
  status text not null default 'Aberto',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists recurring_payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  provider text not null,
  external_id text,
  amount numeric(12,2) not null default 0,
  interval text not null,
  status text not null default 'Ativa',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ocr_documents (
  id uuid primary key default gen_random_uuid(),
  payable_id uuid references payables(id) on delete set null,
  filename text,
  mime_type text,
  storage_ref text,
  extracted_data jsonb not null default '{}'::jsonb,
  status text not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists account_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_master_payments_status_created on payments(status,created_at desc);
create index if not exists idx_master_receivables_status_due on receivables(status,due_at);
create index if not exists idx_master_payables_status_due on payables(status,due_at);
create index if not exists idx_master_agenda_blocks_time on agenda_blocks(starts_at,ends_at);
create index if not exists idx_master_ocr_status on ocr_documents(status);

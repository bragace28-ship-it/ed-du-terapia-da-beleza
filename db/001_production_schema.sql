-- ED & DU production bootstrap (Neon/PostgreSQL)
-- No demo/test rows are inserted here.
-- Definition tables (coupons/services/settings/rules) are intentionally preserved by reset scripts.

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

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  notes text,
  status text not null default 'Ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists professionals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete set null,
  name text not null,
  email text,
  status text not null default 'Ativo',
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  base_price numeric(12,2) not null default 0,
  long_price numeric(12,2),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
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

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  professional_id uuid references professionals(id) on delete set null,
  service_id uuid references services(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'Agendado',
  notes text,
  source text not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
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

create table if not exists commands (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  professional_id uuid references professionals(id) on delete set null,
  status text not null default 'Em andamento',
  gross_amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  net_amount numeric(12,2) not null default 0,
  coupon_id uuid references coupons(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists command_items (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null references commands(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  description text,
  size text,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0
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

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_client_id uuid references clients(id) on delete set null,
  referred_name text not null,
  referred_phone text,
  gift_card_id uuid,
  status text not null default 'Pendente',
  points_awarded integer not null default 0,
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

alter table referrals drop constraint if exists referrals_gift_card_id_fkey;
alter table referrals add constraint referrals_gift_card_id_fkey foreign key (gift_card_id) references gift_cards(id) on delete set null;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  type text,
  title text,
  message text,
  read_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
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

create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists finance_pin_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  user_id uuid references app_users(id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_appointments_professional_time on appointments(professional_id, starts_at, ends_at);
create index if not exists idx_appointments_client_time on appointments(client_id, starts_at desc);
create index if not exists idx_payments_status_created on payments(status, created_at desc);
create index if not exists idx_receivables_status_due on receivables(status, due_at);
create index if not exists idx_payables_status_due on payables(status, due_at);
create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);
create index if not exists idx_audit_logs_created on audit_logs(created_at desc);


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
  source_ref text,
  extracted_data jsonb not null default '{}'::jsonb,
  confidence numeric(5,4),
  human_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists account_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  action text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_loyalty_transactions_account_created on loyalty_transactions(loyalty_account_id, created_at desc);
create index if not exists idx_credit_alerts_client_status on credit_alerts(client_id, status);
create index if not exists idx_recurring_payments_client_status on recurring_payments(client_id, status);

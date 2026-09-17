-- ED & DU V33 — homologação: produtos, PDV e lançamento financeiro idempotente.
create table if not exists public.products(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  price numeric not null default 0,
  cost numeric not null default 0,
  stock integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.command_items alter column service_id drop not null;
alter table public.command_items add column if not exists product_id uuid references public.products(id);
alter table public.command_items drop constraint if exists command_items_service_or_product_check;
alter table public.command_items add constraint command_items_service_or_product_check check(service_id is not null or product_id is not null);
create index if not exists products_org_idx on public.products(organization_id);
alter table public.products enable row level security;
drop policy if exists products_org on public.products;
drop policy if exists products_staff on public.products;
create policy products_org on public.products for select to authenticated using(organization_id=public.current_organization_id() and(active or public.is_org_staff()));
create policy products_staff on public.products for all to authenticated using(organization_id=public.current_organization_id() and public.is_org_staff()) with check(organization_id=public.current_organization_id());

create unique index if not exists command_payments_transaction_reference_uq on public.command_payments(transaction_reference) where transaction_reference is not null;

create or replace function public.create_financial_entry_from_command_payment() returns trigger language plpgsql security definer set search_path=public as $$
declare c public.commands; existing uuid;
begin
  select * into c from public.commands where id=new.command_id;
  if c.id is null then return new; end if;
  select id into existing from public.financial_transactions where source_id=new.id limit 1;
  if existing is null then
    insert into public.financial_transactions(type,description,amount,paid_at,status,command_id,client_id,professional_id,scope,category,source_type,source_id,organization_id)
    values('revenue','Comanda paga via PDV / Maquininha',new.amount,new.paid_at,'paid',c.id,c.client_id,c.professional_id,'salon','vendas','card',new.id,new.organization_id);
  end if;
  return new;
end$$;
drop trigger if exists trg_command_payment_financial on public.command_payments;
create trigger trg_command_payment_financial after insert on public.command_payments for each row execute function public.create_financial_entry_from_command_payment();

create or replace view public.financial_entries as select * from public.financial_transactions;

-- ED & DU V33 — seed de homologação
-- Este script NÃO armazena senha nem tenta escrever diretamente em auth.users.
-- Crie o usuário pelo Supabase Auth com:
--   admin.homologacao@ededuterapiadabeleza.online
-- Depois execute este seed com privilégio administrativo para promover o usuário.

begin;

do $$
declare
  u uuid;
  o uuid;
  svc uuid;
  prod uuid;
begin
  select id into u from auth.users where lower(email)=lower('admin.homologacao@ededuterapiadabeleza.online');
  if u is null then
    raise exception 'Usuário de homologação não existe. Crie-o pelo Supabase Auth antes de executar este seed.';
  end if;

  select id into o from public.organizations where active order by created_at limit 1;
  if o is null then
    insert into public.organizations(name,owner_user_id,active)
    values('ED & DU | Terapia da Beleza',u,true)
    returning id into o;
  end if;

  update public.profiles
     set full_name='EDDU Homologação', role='admin', active=true, organization_id=o
   where id=u;

  insert into public.organization_members(organization_id,user_id,role,active)
  values(o,u,'admin',true)
  on conflict(organization_id,user_id) do update set role='admin',active=true;

  insert into public.professionals(user_id,name,active,organization_id)
  values(u,'EDDU Homologação',true,o)
  on conflict do nothing;

  select id into svc from public.services
   where organization_id=o and active and lower(name)=lower('Serviço de Homologação V33') limit 1;
  if svc is null then
    insert into public.services(name,description,price_base,price_long,service_cost,duration_minutes,active,organization_id)
    values('Serviço de Homologação V33','Item criado exclusivamente para QA de produção',100,100,20,60,true,o)
    returning id into svc;
  end if;

  select id into prod from public.products
   where organization_id=o and active and lower(name)=lower('Produto de Homologação V33') limit 1;
  if prod is null then
    insert into public.products(organization_id,name,description,price,cost,stock,active)
    values(o,'Produto de Homologação V33','Item criado exclusivamente para QA de produção',50,10,100,true)
    returning id into prod;
  end if;

  insert into public.payment_methods(name,active,organization_id)
  select 'PDV / Maquininha',true,o
  where not exists(select 1 from public.payment_methods where organization_id=o and name='PDV / Maquininha');
end $$;

commit;

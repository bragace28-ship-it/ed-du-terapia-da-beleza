-- ED & DU V33 — seed de perfis profissionais.
-- Não cria nem grava senhas em auth.users. Os três usuários devem existir no Supabase Auth.
-- Para criar/confirmar usuários e senha com segurança, use scripts/create_professionals.ts.

begin;

do $$
declare
  org_id uuid;
  user_id uuid;
  professional record;
begin
  select id into org_id
  from public.organizations
  where active
  order by created_at
  limit 1;

  if org_id is null then
    raise exception 'Nenhuma organização ativa encontrada.';
  end if;

  for professional in
    select * from (values
      ('carlos@ededuterapiadabeleza.online'::text, 'Carlos'::text),
      ('du@ededuterapiadabeleza.online'::text, 'Du'::text),
      ('ed@ededuterapiadabeleza.online'::text, 'Ed / Edgar'::text)
    ) as p(email, name)
  loop
    select id into user_id
    from auth.users
    where lower(email)=lower(professional.email);

    if user_id is null then
      raise exception 'Usuário Auth ausente: %. Execute scripts/create_professionals.ts primeiro.', professional.email;
    end if;

    update public.profiles
       set full_name=professional.name,
           role='professional',
           active=true,
           organization_id=org_id
     where id=user_id;

    insert into public.organization_members(organization_id,user_id,role,active)
    values(org_id,user_id,'professional',true)
    on conflict(organization_id,user_id)
    do update set role='professional',active=true;

    if exists(select 1 from public.professionals where user_id=user_id) then
      update public.professionals
         set name=professional.name, active=true, organization_id=org_id
       where user_id=user_id;
    else
      insert into public.professionals(user_id,name,active,organization_id)
      values(user_id,professional.name,true,org_id);
    end if;
  end loop;
end $$;

commit;

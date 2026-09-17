-- ED & DU V33 production hardening: single auth trigger, webhook organization scope and least-privilege helper execution.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path=public,auth as $$
declare o uuid; n text;
begin
  select id into o from public.organizations where active order by created_at limit 1;
  if o is null then
    insert into public.organizations(name,owner_user_id) values('ED & DU | Terapia da Beleza',new.id) returning id into o;
  end if;
  n:=coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1),'Cliente');
  insert into public.profiles(id,full_name,role,active,organization_id)
    values(new.id,n,'client',true,o)
    on conflict(id) do update set organization_id=excluded.organization_id,full_name=coalesce(public.profiles.full_name,excluded.full_name);
  insert into public.organization_members(organization_id,user_id,role,active)
    values(o,new.id,'client',true)
    on conflict(organization_id,user_id) do update set active=true,role='client';
  insert into public.clients(user_id,name,email,active,organization_id)
    values(new.id,n,new.email,true,o)
    on conflict do nothing;
  return new;
end$$;

drop trigger if exists on_auth_user_created_eddu on auth.users;
create trigger on_auth_user_created_eddu after insert on auth.users for each row execute function public.handle_new_auth_user();

alter table public.webhook_events add column if not exists organization_id uuid references public.organizations(id);
update public.webhook_events set organization_id=(select id from public.organizations order by created_at limit 1) where organization_id is null;
alter table public.webhook_events alter column organization_id set not null;
create index if not exists webhook_events_organization_id_idx on public.webhook_events(organization_id);
create index if not exists webhook_events_provider_event_idx on public.webhook_events(provider,event_id);

revoke execute on function public.current_organization_id() from public;
revoke execute on function public.is_org_staff() from public;
revoke execute on function public.is_org_admin() from public;
revoke execute on function public.transition_command_state(uuid,text) from public;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.is_org_staff() to authenticated;
grant execute on function public.is_org_admin() to authenticated;
grant execute on function public.transition_command_state(uuid,text) to authenticated;

do $$begin
  if to_regclass('public.pagbank_webhook_events') is not null then
    alter table public.pagbank_webhook_events enable row level security;
    drop policy if exists service_only_deny on public.pagbank_webhook_events;
    create policy service_only_deny on public.pagbank_webhook_events for all to anon,authenticated using(false) with check(false);
  end if;
  if to_regclass('public.payment_provider_events') is not null then
    alter table public.payment_provider_events enable row level security;
    drop policy if exists service_only_deny on public.payment_provider_events;
    create policy service_only_deny on public.payment_provider_events for all to anon,authenticated using(false) with check(false);
  end if;
end$$;

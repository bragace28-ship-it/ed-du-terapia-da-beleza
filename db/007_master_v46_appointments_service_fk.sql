-- Master V46: appointment service relationship (additive and idempotent).
-- Apply first to the isolated homologation branch; production rollout is gated.
alter table public.appointments add column if not exists service_id uuid;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='appointments_service_id_fkey'
      and conrelid='public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_service_id_fkey
      foreign key (service_id) references public.services(id) on delete set null;
  end if;
end $$;

create policy profiles_self_insert on public.profiles for insert to authenticated with check (id=auth.uid() and role='client');
create policy clients_self_read on public.clients for select to authenticated using (user_id=auth.uid());
create policy clients_self_insert on public.clients for insert to authenticated with check (user_id=auth.uid());

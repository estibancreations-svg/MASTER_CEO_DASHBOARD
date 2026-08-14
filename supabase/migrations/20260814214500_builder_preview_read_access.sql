-- Temporary builder preview: unauthenticated reads of non-sensitive dashboard read models only.
begin;
create policy "builder preview reads system status" on public.ceo_system_status for select to anon using(organization_id='20e10428-4443-4324-b36a-e68d64ec26ed');
create policy "builder preview reads integrations" on public.ceo_integrations for select to anon using(organization_id='20e10428-4443-4324-b36a-e68d64ec26ed');
create policy "builder preview reads module records" on public.ceo_module_records for select to anon using(organization_id='20e10428-4443-4324-b36a-e68d64ec26ed');
commit;

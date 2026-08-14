-- Builder preview must never expose production read models to anonymous users.
drop policy if exists "builder preview reads system status" on public.ceo_system_status;
drop policy if exists "builder preview reads integrations" on public.ceo_integrations;
drop policy if exists "builder preview reads module records" on public.ceo_module_records;

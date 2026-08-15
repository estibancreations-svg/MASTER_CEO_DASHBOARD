begin;
create index if not exists ceo_module_activity_record_id_idx on public.ceo_module_activity(module_record_id);
create index if not exists ceo_module_activity_actor_id_idx on public.ceo_module_activity(actor_id);
commit;

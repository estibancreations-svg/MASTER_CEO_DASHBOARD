-- Tighten Data API grants; RLS remains the row-level authorization boundary.
begin;
revoke all on public.ec_connectors,public.ec_workflows,public.ec_module_bindings,public.ec_integration_jobs,public.ec_job_events,public.ec_dead_letters from anon;
revoke delete,truncate,references,trigger on public.ec_connectors,public.ec_workflows,public.ec_module_bindings,public.ec_integration_jobs,public.ec_job_events,public.ec_dead_letters from authenticated;
grant select on public.ec_connectors,public.ec_workflows,public.ec_module_bindings,public.ec_dead_letters to authenticated;
grant select,insert,update on public.ec_integration_jobs to authenticated;
grant select,insert on public.ec_job_events to authenticated;
commit;

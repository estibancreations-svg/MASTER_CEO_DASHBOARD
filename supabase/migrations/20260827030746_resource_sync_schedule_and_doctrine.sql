create table if not exists public.resource_sync_runs(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trigger_type text not null,
  status text not null default 'RUNNING',
  providers_attempted integer not null default 0,
  providers_succeeded integer not null default 0,
  systems_reported integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_summary text,
  evidence jsonb not null default '{}'::jsonb
);
alter table public.resource_sync_runs enable row level security;
create policy resource_sync_runs_org_read on public.resource_sync_runs for select using(public.is_active_org_member(organization_id));

do $$ begin
  if not exists(select 1 from vault.decrypted_secrets where name='THELMA_RESOURCE_CRON_SECRET') then
    perform vault.create_secret(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),'THELMA_RESOURCE_CRON_SECRET','Internal THELMA resource-intelligence cron authorization',null);
  end if;
end $$;

insert into public.analyst_memory(organization_id,memory_key,system_key,category,title,summary,body,memory_state,trust_level,source_ref,provenance,tags,effective_at)
select o.id,'THELMA-RESOURCE-INTELLIGENCE-DOCTRINE','SYS-THELMA-001','OPERATING_DOCTRINE','THELMA resource, balance and model-routing doctrine',
'THELMA checks available credits/entitlements at startup, tracks usage continuously, prefers eligible free/included/prepaid capacity without sacrificing standards, supports manual provider/model overrides, and runs model/tool research every Monday and Thursday.',
'THELMA must report resource availability for every registered system at daily startup and continuously record usage for billing/chargeback. Routing is not simply free-first: rights, privacy, capability, quality, deadline and reliability are hard gates. Runway is a preferred VisionWeaver production provider. The CEO may force a provider/model for a project, including Runway or a ChatGPT/OpenAI project path where applicable. The Ecosystem/Model Intelligence review runs Mondays and Thursdays and tracks new models/tools, pricing/free allowances, provider changes and empirical best-model-by-task performance.',
'ACTIVE_CANON','VERIFIED','CEO directive 2026-08-27',jsonb_build_object('authority','CEO','directive_date','2026-08-27'),array['resource-intelligence','billing','routing','runway','model-research','daily-startup'],now()
from public.ceo_organizations o
on conflict(organization_id,memory_key) do update set summary=excluded.summary,body=excluded.body,memory_state='ACTIVE_CANON',trust_level='VERIFIED',source_ref=excluded.source_ref,provenance=excluded.provenance,tags=excluded.tags,effective_at=excluded.effective_at,updated_at=now();

select cron.unschedule(jobid) from cron.job where jobname in ('thelma-ecosystem-weekly','thelma-ecosystem-model-review','thelma-resource-daily-baseline','thelma-resource-daily-sync');

select cron.schedule('thelma-ecosystem-model-review','0 13 * * 1,4',$$select net.http_post(
  url:='https://yqealeekngxooyoemfba.supabase.co/functions/v1/ecosystem-watch',
  headers:=jsonb_build_object('content-type','application/json','x-thelma-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='THELMA_ECOSYSTEM_CRON_SECRET' limit 1)),
  body:=jsonb_build_object('trigger','monday_thursday_model_tool_review')
);$$);

select cron.schedule('thelma-resource-daily-sync','0 12 * * *',$$select net.http_post(
  url:='https://yqealeekngxooyoemfba.supabase.co/functions/v1/resource-intelligence',
  headers:=jsonb_build_object('content-type','application/json','x-thelma-resource-secret',(select decrypted_secret from vault.decrypted_secrets where name='THELMA_RESOURCE_CRON_SECRET' limit 1)),
  body:=jsonb_build_object('action','startup','trigger','daily_cron')
);$$);

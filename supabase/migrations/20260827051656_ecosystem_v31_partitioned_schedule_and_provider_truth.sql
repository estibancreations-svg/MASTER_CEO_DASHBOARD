select cron.unschedule(jobid) from cron.job where jobname in ('thelma-ecosystem-model-review','thelma-ecosystem-model-review-p1','thelma-ecosystem-model-review-p2','thelma-ecosystem-model-review-p3');

select cron.schedule('thelma-ecosystem-model-review-p1','0 13 * * 1,4',$$select net.http_post(
  url:='https://yqealeekngxooyoemfba.supabase.co/functions/v1/ecosystem-watch',
  headers:=jsonb_build_object('content-type','application/json','x-thelma-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='THELMA_ECOSYSTEM_CRON_SECRET' limit 1)),
  body:=jsonb_build_object('trigger','monday_thursday_enterprise_review','partition_index',0,'partition_count',3,'run_model_research',true)
);$$);

select cron.schedule('thelma-ecosystem-model-review-p2','2 13 * * 1,4',$$select net.http_post(
  url:='https://yqealeekngxooyoemfba.supabase.co/functions/v1/ecosystem-watch',
  headers:=jsonb_build_object('content-type','application/json','x-thelma-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='THELMA_ECOSYSTEM_CRON_SECRET' limit 1)),
  body:=jsonb_build_object('trigger','monday_thursday_enterprise_review','partition_index',1,'partition_count',3,'run_model_research',false)
);$$);

select cron.schedule('thelma-ecosystem-model-review-p3','4 13 * * 1,4',$$select net.http_post(
  url:='https://yqealeekngxooyoemfba.supabase.co/functions/v1/ecosystem-watch',
  headers:=jsonb_build_object('content-type','application/json','x-thelma-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='THELMA_ECOSYSTEM_CRON_SECRET' limit 1)),
  body:=jsonb_build_object('trigger','monday_thursday_enterprise_review','partition_index',2,'partition_count',3,'run_model_research',false)
);$$);

insert into public.analyst_memory(organization_id,memory_key,system_key,category,title,summary,body,memory_state,trust_level,source_ref,provenance,tags,effective_at)
select o.id,'ECOSYSTEM-V31-ENTERPRISE-SCHEDULE','SYS-THELMA-001','OPERATING_DOCTRINE','Ecosystem Scout v3.1 enterprise partition schedule',
'Ecosystem Scout covers all registered systems on Monday and Thursday using three staggered GitHub-search partitions plus an official-provider research lane.',
'The enterprise Ecosystem Scout runs Mondays and Thursdays in three partitions at 13:00, 13:02, and 13:04 UTC. Partitioning keeps public GitHub repository discovery below unauthenticated search-rate ceilings while preserving same-day enterprise coverage. The first partition also runs official provider/model research when a funded search-capable model is available. Research failures or provider-credit exhaustion must be reported as blocked/partial rather than green. Candidate discoveries never auto-promote to production.',
'ACTIVE_CANON','VERIFIED','CEO directive + release certification 2026-08-27',
jsonb_build_object('ecosystem_version','v3.1-enterprise','partition_count',3,'schedule_utc',jsonb_build_array('13:00','13:02','13:04'),'days',jsonb_build_array('Monday','Thursday')),
array['ecosystem','research','models','tools','github','rate-limit','schedule'],now()
from public.ceo_organizations o
on conflict(organization_id,memory_key) do update set summary=excluded.summary,body=excluded.body,memory_state='ACTIVE_CANON',trust_level='VERIFIED',source_ref=excluded.source_ref,provenance=excluded.provenance,tags=excluded.tags,effective_at=excluded.effective_at,updated_at=now();

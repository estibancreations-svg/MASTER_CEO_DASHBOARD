-- Canonicalize OpenAI credential naming across active runtime registries and analyst memory.
-- Historical applied migration files remain immutable evidence; active state converges on OPENAI_API_ACCESS.

update public.ec_connectors
set required_secrets = array_replace(required_secrets,'OPENAI_API_KEY','OPENAI_API_ACCESS'),
    updated_at = now()
where 'OPENAI_API_KEY' = any(required_secrets);

update public.ceo_integrations
set required_secrets = array_replace(required_secrets,'OPENAI_API_KEY','OPENAI_API_ACCESS'),
    updated_at = now()
where 'OPENAI_API_KEY' = any(required_secrets);

update public.thelma_plugin_registry
set credential_ref_name = case when credential_ref_name='OPENAI_API_KEY' then 'OPENAI_API_ACCESS' else credential_ref_name end,
    notes = replace(coalesce(notes,''),'OPENAI_API_KEY','OPENAI_API_ACCESS'),
    metadata = case when coalesce(metadata,'{}'::jsonb)::text ilike '%OPENAI_API_KEY%' then replace(metadata::text,'OPENAI_API_KEY','OPENAI_API_ACCESS')::jsonb else metadata end,
    updated_at = now()
where credential_ref_name='OPENAI_API_KEY'
   or coalesce(notes,'') ilike '%OPENAI_API_KEY%'
   or coalesce(metadata,'{}'::jsonb)::text ilike '%OPENAI_API_KEY%';

update public.analyst_findings
set description = replace(coalesce(description,''),'OPENAI_API_KEY','OPENAI_API_ACCESS'),
    current_state = replace(coalesce(current_state,''),'OPENAI_API_KEY','OPENAI_API_ACCESS'),
    desired_state = replace(coalesce(desired_state,''),'OPENAI_API_KEY','OPENAI_API_ACCESS'),
    remediation_plan = replace(coalesce(remediation_plan,''),'OPENAI_API_KEY','OPENAI_API_ACCESS'),
    metadata = case when coalesce(metadata,'{}'::jsonb)::text ilike '%OPENAI_API_KEY%' then replace(metadata::text,'OPENAI_API_KEY','OPENAI_API_ACCESS')::jsonb else metadata end,
    updated_at = now()
where (coalesce(description,'')||' '||coalesce(current_state,'')||' '||coalesce(desired_state,'')||' '||coalesce(remediation_plan,'')||' '||coalesce(metadata,'{}'::jsonb)::text) ilike '%OPENAI_API_KEY%';

update public.analyst_memory
set summary = replace(coalesce(summary,''),'OPENAI_API_KEY','OPENAI_API_ACCESS'),
    body = replace(coalesce(body,''),'OPENAI_API_KEY','OPENAI_API_ACCESS'),
    provenance = case when coalesce(provenance,'{}'::jsonb)::text ilike '%OPENAI_API_KEY%' then replace(provenance::text,'OPENAI_API_KEY','OPENAI_API_ACCESS')::jsonb else provenance end,
    updated_at = now()
where (coalesce(summary,'')||' '||coalesce(body,'')||' '||coalesce(provenance,'{}'::jsonb)::text) ilike '%OPENAI_API_KEY%';

update public.system_memory
set title = replace(coalesce(title,''),'OPENAI_API_KEY','OPENAI_API_ACCESS'),
    body = replace(coalesce(body,''),'OPENAI_API_KEY','OPENAI_API_ACCESS'),
    provenance = case when coalesce(provenance,'{}'::jsonb)::text ilike '%OPENAI_API_KEY%' then replace(provenance::text,'OPENAI_API_KEY','OPENAI_API_ACCESS')::jsonb else provenance end,
    updated_at = now()
where (coalesce(title,'')||' '||coalesce(body,'')||' '||coalesce(provenance,'{}'::jsonb)::text) ilike '%OPENAI_API_KEY%';

update public.system_settings
set value = case when value::text ilike '%OPENAI_API_KEY%' then replace(value::text,'OPENAI_API_KEY','OPENAI_API_ACCESS')::jsonb else value end,
    vault_ref = case when vault_ref='OPENAI_API_KEY' then 'OPENAI_API_ACCESS' else vault_ref end,
    updated_at = now()
where value::text ilike '%OPENAI_API_KEY%' or vault_ref='OPENAI_API_KEY';

update public.analyst_actions
set summary = replace(coalesce(summary,''),'OPENAI_API_KEY','OPENAI_API_ACCESS'),
    metadata = case when coalesce(metadata,'{}'::jsonb)::text ilike '%OPENAI_API_KEY%' then replace(metadata::text,'OPENAI_API_KEY','OPENAI_API_ACCESS')::jsonb else metadata end,
    updated_at = now()
where (coalesce(summary,'')||' '||coalesce(metadata,'{}'::jsonb)::text) ilike '%OPENAI_API_KEY%';

insert into public.analyst_memory(
  organization_id,memory_key,system_key,category,title,summary,body,memory_state,trust_level,source_ref,provenance,tags,effective_at
)
select o.id,
       'CREDENTIAL-NAMING-OPENAI-ACCESS',
       'SYS-THELMA-001',
       'credential_governance',
       'OpenAI credential canonical name',
       'OPENAI_API_ACCESS is the only canonical OpenAI credential name for EstibanCreations runtimes and automation.',
       'Do not create, reference, request, or document OPENAI_API_KEY. Runtime code, Supabase registries, GitHub Actions, Codex repair automation, THELMA, provider/plugin registries, activation guides, Analyst Memory, tests, and future integrations must use OPENAI_API_ACCESS. Historical applied migrations may retain the former name only as immutable provenance and must be superseded by later canonical migrations.',
       'ACTIVE_CANON','VERIFIED','user-directive-2026-08-26',
       jsonb_build_object('directive','OPENAI_API_ACCESS canonical; KEY naming retired','applied_migration','canonicalize_openai_api_access','verified_at',now()),
       array['openai','credentials','access','canonical-naming'],now()
from public.ceo_organizations o
where o.slug='estiban-creations'
on conflict (organization_id,memory_key) do update
set summary=excluded.summary,body=excluded.body,memory_state='ACTIVE_CANON',trust_level='VERIFIED',source_ref=excluded.source_ref,provenance=excluded.provenance,tags=excluded.tags,effective_at=excluded.effective_at,updated_at=now();

insert into public.analyst_actions(
  organization_id,action_key,action_type,status,summary,actor,migration_version,metadata,executed_at,verified_at
)
select o.id,
       'OPENAI-API-ACCESS-CANONICAL-RENAME',
       'CONFIGURATION_REPAIR',
       'VERIFIED',
       'Canonicalized active Supabase references from the retired OpenAI KEY name to OPENAI_API_ACCESS.',
       'ChatGPT reconstruction workflow',
       'canonicalize_openai_api_access',
       jsonb_build_object('canonical_secret','OPENAI_API_ACCESS','retired_name','OPENAI_API_'||'KEY','historical_migrations_immutable',true),
       now(),now()
from public.ceo_organizations o
where o.slug='estiban-creations'
on conflict (organization_id,action_key) do update
set status='VERIFIED',summary=excluded.summary,migration_version=excluded.migration_version,metadata=excluded.metadata,executed_at=excluded.executed_at,verified_at=excluded.verified_at,updated_at=now();

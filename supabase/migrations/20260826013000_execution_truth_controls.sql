-- Repairs 11-15: provider drift, ownership lineage, business observability,
-- capability-weighted certification, and the eleven-link reconstruction gate.

create table if not exists public.provider_drift_registry(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
 provider_key text not null, capability_key text not null, configured_identifier text, observed_identifier text,
 lifecycle_state text not null default 'NEEDS_VERIFICATION' check(lifecycle_state in ('CURRENT','NEEDS_VERIFICATION','DRIFTED','DEPRECATED','BLOCKED')),
 pricing_state text not null default 'NEEDS_VERIFICATION' check(pricing_state in ('CURRENT','NEEDS_VERIFICATION','DRIFTED')),
 auth_state text not null default 'NEEDS_VERIFICATION' check(auth_state in ('CURRENT','NEEDS_VERIFICATION','DRIFTED','BLOCKED')),
 source_url text, last_verified_at timestamptz, next_review_at timestamptz, evidence jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,provider_key,capability_key)
);
create table if not exists public.provider_drift_events(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
 provider_key text not null, capability_key text not null, drift_type text not null,
 severity text not null check(severity in ('critical','high','medium','low','info')),
 status text not null default 'OPEN' check(status in ('OPEN','ACKNOWLEDGED','FIXED','SUPERSEDED','FALSE_POSITIVE')),
 summary text not null, before_state jsonb not null default '{}', after_state jsonb not null default '{}', source_url text,
 detected_at timestamptz not null default now(), verified_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.enterprise_account_registry(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
 service_key text not null, account_label text not null, resource_locator text, purpose text not null,
 business_owner text not null default 'CEO', technical_owner text, billing_owner text, recovery_owner text,
 ownership_state text not null default 'NEEDS_VERIFICATION' check(ownership_state in ('VERIFIED','NEEDS_VERIFICATION','TRANSFER_PENDING','BLOCKED','RETIRED')),
 credential_location text, recovery_method text, last_verified_at timestamptz, evidence jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,service_key,account_label)
);
create table if not exists public.business_workflow_contracts(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
 system_key text not null, workflow_key text not null, workflow_name text not null, primary_outcome text not null,
 required_inputs jsonb not null default '[]', required_outputs jsonb not null default '[]', required_evidence jsonb not null default '[]',
 health_state text not null default 'NOT_CERTIFIED' check(health_state in ('HEALTHY','DEGRADED','FAILING','UNKNOWN','NOT_IMPLEMENTED','NOT_CERTIFIED')),
 last_success_at timestamptz, last_checked_at timestamptz, failure_reason text, evidence jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,system_key,workflow_key)
);
create table if not exists public.capability_certification_snapshots(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
 system_key text not null, total_requirements integer not null default 0, implemented_requirements integer not null default 0,
 integrated_requirements integer not null default 0, tested_requirements integer not null default 0, certified_requirements integer not null default 0,
 specification_score numeric(5,2) not null default 0, implementation_score numeric(5,2) not null default 0,
 integration_score numeric(5,2) not null default 0, test_score numeric(5,2) not null default 0,
 security_score numeric(5,2) not null default 0, operational_score numeric(5,2) not null default 0,
 certification_score numeric(5,2) not null default 0, certification_state text not null default 'NOT_CERTIFIED',
 denominator_evidence jsonb not null default '{}', calculated_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,system_key)
);
create table if not exists public.reconstruction_gate_evidence(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
 system_key text not null, gate_key text not null, gate_order integer not null check(gate_order between 1 and 11),
 gate_state text not null default 'NOT_EVIDENCED' check(gate_state in ('NOT_EVIDENCED','PARTIAL','EVIDENCED','FAILED','STALE')),
 evidence jsonb not null default '{}', release_ref text, verified_at timestamptz, verified_by text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,system_key,gate_key)
);

do $$ declare t text; begin
 foreach t in array array['provider_drift_registry','provider_drift_events','enterprise_account_registry','business_workflow_contracts','capability_certification_snapshots','reconstruction_gate_evidence'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists %I on public.%I',t||'_member_select',t);
  execute format('create policy %I on public.%I for select to authenticated using (public.is_active_org_member(organization_id))',t||'_member_select',t);
  execute format('revoke all on table public.%I from anon,authenticated',t);
  execute format('grant select on table public.%I to authenticated',t);
  execute format('grant select,insert,update,delete on table public.%I to service_role',t);
  execute format('drop trigger if exists %I on public.%I','touch_'||t,t);
  execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()','touch_'||t,t);
 end loop;
end $$;

create index if not exists provider_drift_open_idx on public.provider_drift_events(organization_id,status,severity,detected_at desc);
create index if not exists account_ownership_state_idx on public.enterprise_account_registry(organization_id,ownership_state);
create index if not exists workflow_health_idx on public.business_workflow_contracts(organization_id,health_state,system_key);
create index if not exists reconstruction_gate_state_idx on public.reconstruction_gate_evidence(organization_id,gate_state,system_key);

insert into public.provider_drift_registry(organization_id,provider_key,capability_key,configured_identifier,lifecycle_state,pricing_state,auth_state,source_url,last_verified_at,next_review_at,evidence)
select o.id,lower(m.provider),m.model_name,m.gateway_model_id,
 case when m.deprecating_on is not null and m.deprecating_on<current_date then 'DEPRECATED'
      when m.last_verified_at is null or m.last_verified_at<now()-interval '30 days' then 'NEEDS_VERIFICATION' else 'CURRENT' end,
 'NEEDS_VERIFICATION','NEEDS_VERIFICATION',m.pricing_source_url,m.last_verified_at,now()+interval '7 days',
 jsonb_build_object('catalog_id',m.id,'active_flag',m.is_active,'deprecating_on',m.deprecating_on)
from public.ceo_organizations o cross join public.model_catalog m
on conflict(organization_id,provider_key,capability_key) do update set
 configured_identifier=excluded.configured_identifier,lifecycle_state=excluded.lifecycle_state,
 source_url=excluded.source_url,last_verified_at=excluded.last_verified_at,next_review_at=excluded.next_review_at,evidence=excluded.evidence,updated_at=now();

insert into public.provider_drift_events(organization_id,provider_key,capability_key,drift_type,severity,summary,before_state,source_url)
select o.id,lower(m.provider),m.model_name,'PAST_DEPRECATION_DATE','high',
       'Model remains active after its recorded deprecation date.',
       jsonb_build_object('is_active',m.is_active,'deprecating_on',m.deprecating_on),m.pricing_source_url
from public.ceo_organizations o cross join public.model_catalog m
where m.is_active=true and m.deprecating_on<current_date
 and not exists(select 1 from public.provider_drift_events e where e.organization_id=o.id and e.provider_key=lower(m.provider) and e.capability_key=m.model_name and e.drift_type='PAST_DEPRECATION_DATE' and e.status='OPEN');

update public.model_catalog set is_active=false,updated_at=now()
where is_active=true and deprecating_on<current_date;

insert into public.enterprise_account_registry(organization_id,service_key,account_label,resource_locator,purpose,technical_owner,credential_location,recovery_method,evidence)
select o.id,v.* from public.ceo_organizations o cross join(values
 ('github','MASTER_CEO_DASHBOARD','estibancreations-svg/MASTER_CEO_DASHBOARD','Canonical application source and CI/CD','CEO + THELMA','GitHub repository/org settings','Verify owner access, recovery methods, branch rules and billing',jsonb_build_object('known',true)),
 ('supabase','CEO Production','yqealeekngxooyoemfba','Canonical database, auth, memory and Edge runtime','CEO + THELMA','Supabase Vault + project settings','Verify organization owner, recovery access and billing',jsonb_build_object('known',true)),
 ('vercel','CEO Production','prj_GJCO17nWhjFrEliqgYHXTWXjDA9H','Production web deployment','CEO + THELMA','Vercel project/team settings','Verify team owner, recovery access, domains and billing',jsonb_build_object('known',true)),
 ('openai','THELMA Models',null,'THELMA reasoning and Codex repair specialist','CEO + THELMA','OpenAI project keys / workload identity','Verify project owner, spend limits and key rotation',jsonb_build_object('dedicated_codex_key_created',true)),
 ('anthropic','THELMA Claude',null,'Claude reasoning route','CEO + THELMA','Supabase Vault','Verify console owner, billing, expiry and rotation',jsonb_build_object('vault_reference','ANTHROPIC_API_KEY')),
 ('figma','Design Workspace',null,'Design context and approved canvas work','CEO + Design Specialist','Figma OAuth/workspace','Verify workspace owner, team access and recovery',jsonb_build_object('chatgpt_connection_only',true)),
 ('replit','Logistics Runtime','rounded-lumpy-assembly--stevenhenry80.replit.app','THELMA logistics application','CEO + Logistics','Replit project secrets','Verify workspace ownership, billing and recovery',jsonb_build_object('published',true)),
 ('base44','Deferred Runtime',null,'Deferred alternate runtime','CEO','Base44 account','Verify ownership only when reactivated',jsonb_build_object('deferred',true)),
 ('dns','Production Domains',null,'Canonical public domains and DNS','CEO','Registrar and DNS provider','Identify registrar, owner, MFA, billing and recovery',jsonb_build_object('unresolved',true)),
 ('oauth','Identity Providers',null,'Google, Apple and other authentication applications','CEO + Security','Provider consoles','Inventory every client id, owner, redirect URI and recovery path',jsonb_build_object('unresolved',true))
)v(service_key,account_label,resource_locator,purpose,technical_owner,credential_location,recovery_method,evidence)
on conflict(organization_id,service_key,account_label) do update set resource_locator=excluded.resource_locator,purpose=excluded.purpose,evidence=excluded.evidence,updated_at=now();

insert into public.business_workflow_contracts(organization_id,system_key,workflow_key,workflow_name,primary_outcome,required_outputs,required_evidence,health_state,failure_reason,evidence)
select s.organization_id,s.system_key,'PRIMARY-WORKFLOW','Primary user workflow',
       'A user completes the system primary workflow and receives its intended business result.',
       jsonb_build_array('durable domain output'),jsonb_build_array('input','execution receipt','output','validation','audit','failure recovery'),
       case when s.runtime_state='MISSING' then 'NOT_IMPLEMENTED' else 'NOT_CERTIFIED' end,
       case when s.runtime_state='MISSING' then 'Runtime is missing.' else 'No release-bound end-to-end business evidence exists.' end,
       jsonb_build_object('runtime_state',s.runtime_state,'canonical_state',s.canonical_state)
from public.analyst_system_index s
on conflict(organization_id,system_key,workflow_key) do update set health_state=excluded.health_state,failure_reason=excluded.failure_reason,evidence=excluded.evidence,updated_at=now();

insert into public.capability_certification_snapshots(organization_id,system_key,total_requirements,implemented_requirements,integrated_requirements,tested_requirements,certified_requirements,specification_score,implementation_score,integration_score,test_score,security_score,operational_score,certification_score,certification_state,denominator_evidence)
select s.organization_id,s.system_key,count(c.id),
 count(c.id) filter(where c.implementation_state in('IMPLEMENTED','INTEGRATED','TESTED','CERTIFIED','VERIFIED')),
 count(c.id) filter(where c.implementation_state in('INTEGRATED','TESTED','CERTIFIED','VERIFIED')),
 count(c.id) filter(where c.implementation_state in('TESTED','CERTIFIED','VERIFIED')),
 count(c.id) filter(where c.implementation_state in('CERTIFIED','VERIFIED')),
 case when count(c.id)>0 then 100 else 0 end,
 case when count(c.id)>0 then round(100.0*count(c.id)filter(where c.implementation_state in('IMPLEMENTED','INTEGRATED','TESTED','CERTIFIED','VERIFIED'))/count(c.id),2) else 0 end,
 case when count(c.id)>0 then round(100.0*count(c.id)filter(where c.implementation_state in('INTEGRATED','TESTED','CERTIFIED','VERIFIED'))/count(c.id),2) else 0 end,
 case when count(c.id)>0 then round(100.0*count(c.id)filter(where c.implementation_state in('TESTED','CERTIFIED','VERIFIED'))/count(c.id),2) else 0 end,
 0,0,
 case when count(c.id)>0 then round(100.0*count(c.id)filter(where c.implementation_state in('CERTIFIED','VERIFIED'))/count(c.id),2) else 0 end,
 'NOT_CERTIFIED',jsonb_build_object('source','analyst_capabilities','unmapped_requirements',count(c.id)filter(where c.implementation_state='UNMAPPED'))
from public.analyst_system_index s left join public.analyst_capabilities c on c.organization_id=s.organization_id and c.canonical_system_key=s.system_key
group by s.organization_id,s.system_key
on conflict(organization_id,system_key) do update set total_requirements=excluded.total_requirements,implemented_requirements=excluded.implemented_requirements,integrated_requirements=excluded.integrated_requirements,tested_requirements=excluded.tested_requirements,certified_requirements=excluded.certified_requirements,specification_score=excluded.specification_score,implementation_score=excluded.implementation_score,integration_score=excluded.integration_score,test_score=excluded.test_score,security_score=excluded.security_score,operational_score=excluded.operational_score,certification_score=excluded.certification_score,certification_state=excluded.certification_state,denominator_evidence=excluded.denominator_evidence,calculated_at=now();

update public.ceo_system_status set
 provenance=provenance||jsonb_build_object('legacy_percent_retired',progress_percent,'retired_at',now(),'replacement','capability_certification_snapshots'),
 progress_percent=coalesce((select certification_score::integer from public.capability_certification_snapshots c where c.organization_id=ceo_system_status.organization_id and c.system_key=ceo_system_status.system_id),0),
 health_state='unknown',qc_state='not_certified',summary=coalesce(summary,'')||' Legacy percentage retired; capability-weighted certification is authoritative.',updated_at=now();

insert into public.reconstruction_gate_evidence(organization_id,system_key,gate_key,gate_order,gate_state,evidence)
select s.organization_id,s.system_key,g.gate_key,g.gate_order,
 case when g.gate_key='SOURCE' and s.source_of_truth is not null then 'EVIDENCED'
      when g.gate_key='CONTRACT' and exists(select 1 from public.analyst_capabilities c where c.organization_id=s.organization_id and c.canonical_system_key=s.system_key) then 'PARTIAL'
      else 'NOT_EVIDENCED' end,
 case when g.gate_key='SOURCE' then jsonb_build_object('source_of_truth',s.source_of_truth) else '{}'::jsonb end
from public.analyst_system_index s cross join(values
 (1,'SOURCE'),(2,'CONTRACT'),(3,'IMPLEMENTATION'),(4,'AUTHORIZATION'),(5,'EXECUTION'),(6,'OUTPUT'),
 (7,'VALIDATION'),(8,'AUDIT'),(9,'FAILURE_RECOVERY'),(10,'TEST'),(11,'RELEASE_EVIDENCE')
)g(gate_order,gate_key)
on conflict(organization_id,system_key,gate_key) do update set gate_state=excluded.gate_state,evidence=excluded.evidence,updated_at=now();

insert into public.analyst_actions(organization_id,action_key,action_type,status,summary,actor,migration_version,test_ref,metadata,executed_at)
select id,'EXECUTION-TRUTH-CONTROLS-11-15-20260826','CONTROL_PLANE','COMPLETED',
 'Installed provider drift, account ownership, business workflow health, capability-weighted certification and eleven-link reconstruction gate ledgers. Retired legacy percentage authority.',
 'Codex','20260826013000','live SQL verification',jsonb_build_object('repairs',jsonb_build_array(11,12,13,14,15),'production_certified',false),now()
from public.ceo_organizations
on conflict(organization_id,action_key) do update set status='COMPLETED',summary=excluded.summary,metadata=excluded.metadata,executed_at=now(),updated_at=now();

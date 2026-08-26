-- THELMA executive alerts, approval gates, ecosystem discovery, and plugin registry.
-- Canonical sources:
--   Master-System-Buildout/02-SYSTEM-SPECIFICATIONS/T.H.E.L.M.A./README.md
--   Master-System-Buildout/02-SYSTEM-SPECIFICATIONS/Ecosystem-Discovery-Learning-Engine/README.md

create table if not exists public.thelma_approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  source_plan_id uuid references public.thelma_repair_plans(id) on delete set null,
  requested_by_agent text not null default 'THELMA',
  action_type text not null,
  risk_tier text not null check (risk_tier in ('low','medium','high','critical')),
  title text not null,
  description text not null,
  tool_key text,
  proposed_payload jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','EXPIRED','EXECUTED','CANCELLED')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  decision_reason text,
  expires_at timestamptz,
  execution_evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists thelma_approval_source_plan_uq
  on public.thelma_approval_requests(organization_id, source_plan_id)
  where source_plan_id is not null;
create index if not exists thelma_approval_inbox_idx
  on public.thelma_approval_requests(organization_id, status, requested_at desc);

create table if not exists public.thelma_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  source_type text not null,
  source_ref text not null,
  system_key text not null default 'SYS-THELMA-001',
  severity text not null check (severity in ('low','medium','high','critical')),
  title text not null,
  summary text not null,
  recommended_action text,
  approval_required boolean not null default false,
  approval_request_id uuid references public.thelma_approval_requests(id) on delete set null,
  state text not null default 'NEW' check (state in ('NEW','SEEN','ACKNOWLEDGED','RESOLVED','DISMISSED')),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(organization_id, source_type, source_ref)
);
create index if not exists thelma_alert_inbox_idx
  on public.thelma_alerts(organization_id, state, severity, created_at desc);

create table if not exists public.ecosystem_watch_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  source_key text not null,
  system_key text not null,
  query_family text not null,
  search_query text not null,
  source_kind text not null default 'github',
  enabled boolean not null default true,
  minimum_score integer not null default 65 check (minimum_score between 0 and 100),
  cadence text not null default 'weekly',
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, source_key)
);

create table if not exists public.ecosystem_scan_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  triggered_by text not null,
  status text not null default 'RUNNING' check (status in ('QUEUED','RUNNING','SUCCEEDED','PARTIAL','FAILED')),
  sources_scanned integer not null default 0,
  candidates_seen integer not null default 0,
  advisements_created integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_summary text,
  evidence jsonb not null default '{}'::jsonb
);

create table if not exists public.ecosystem_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  watch_source_id uuid references public.ecosystem_watch_sources(id) on delete set null,
  system_key text not null,
  repository text not null,
  url text not null,
  description text,
  license_spdx text,
  stars integer not null default 0,
  forks integer not null default 0,
  open_issues integer not null default 0,
  last_pushed_at timestamptz,
  score integer not null check (score between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  disposition text not null default 'REVIEW' check (disposition in ('REVIEW','ADOPT','ADAPT','REFERENCE','DUPLICATE','REJECT','FUTURE')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_scan_run_id uuid references public.ecosystem_scan_runs(id) on delete set null,
  evidence jsonb not null default '{}'::jsonb,
  unique(organization_id, repository)
);
create index if not exists ecosystem_candidates_rank_idx
  on public.ecosystem_candidates(organization_id, score desc, last_seen_at desc);

create table if not exists public.ecosystem_advisements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  candidate_id uuid not null references public.ecosystem_candidates(id) on delete cascade,
  system_key text not null,
  title text not null,
  why_it_matters text not null,
  recommendation text not null check (recommendation in ('ADOPT','ADAPT','REFERENCE','REJECT','FUTURE')),
  decision_required text not null default 'CEO' check (decision_required in ('NONE','THELMA','C_SUITE','CEO')),
  status text not null default 'PENDING_REVIEW' check (status in ('PENDING_REVIEW','DISCUSSING','APPROVED_FOR_EVAL','REJECTED','DEFERRED','CLOSED')),
  approval_request_id uuid references public.thelma_approval_requests(id) on delete set null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, candidate_id)
);

create table if not exists public.thelma_plugin_registry (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  plugin_key text not null,
  display_name text not null,
  provider text not null,
  capability_class text not null,
  integration_mode text not null,
  transport text,
  auth_strategy text not null,
  connection_state text not null check (connection_state in ('ACTIVE','MODEL_ACTIVE','CHATGPT_ONLY','AWAITING_OAUTH','AWAITING_CREDENTIAL','PLANNED','DEFERRED','BLOCKED')),
  approval_policy text not null default 'ALWAYS_FOR_WRITE',
  allowed_operations text[] not null default '{}',
  prohibited_operations text[] not null default '{}',
  credential_ref_name text,
  endpoint text,
  owner_agent text not null default 'THELMA',
  last_verified_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, plugin_key)
);

do $$
declare t text;
begin
  foreach t in array array['thelma_approval_requests','thelma_alerts','ecosystem_watch_sources','ecosystem_scan_runs','ecosystem_candidates','ecosystem_advisements','thelma_plugin_registry']
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists %I on public.%I',t||'_member_select',t);
    execute format('create policy %I on public.%I for select using (public.is_active_org_member(organization_id))',t||'_member_select',t);
  end loop;
end $$;

drop policy if exists thelma_alerts_member_update on public.thelma_alerts;
create policy thelma_alerts_member_update on public.thelma_alerts for update
  using (public.is_active_org_member(organization_id))
  with check (public.is_active_org_member(organization_id));
drop policy if exists ecosystem_advisements_member_update on public.ecosystem_advisements;
create policy ecosystem_advisements_member_update on public.ecosystem_advisements for update
  using (public.is_active_org_member(organization_id))
  with check (public.is_active_org_member(organization_id));

do $$
declare t text;
begin
  foreach t in array array['thelma_approval_requests','thelma_alerts','ecosystem_watch_sources','ecosystem_advisements','thelma_plugin_registry']
  loop
    execute format('drop trigger if exists %I on public.%I','touch_'||t,t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()','touch_'||t,t);
  end loop;
end $$;

create or replace function public.decide_thelma_approval(p_request_id uuid, p_decision text, p_reason text default null)
returns public.thelma_approval_requests
language plpgsql
security definer
set search_path=public
as $$
declare r public.thelma_approval_requests;
begin
  if p_decision not in ('APPROVED','REJECTED') then raise exception 'invalid_decision'; end if;
  select * into r from public.thelma_approval_requests where id=p_request_id for update;
  if r.id is null then raise exception 'approval_not_found'; end if;
  if not public.is_active_org_member(r.organization_id) then raise exception 'membership_required'; end if;
  if r.status <> 'PENDING' then raise exception 'approval_not_pending'; end if;
  update public.thelma_approval_requests
     set status=p_decision, decided_at=now(), decided_by=auth.uid(), decision_reason=p_reason, updated_at=now()
   where id=p_request_id returning * into r;
  update public.thelma_alerts
     set state='ACKNOWLEDGED', updated_at=now()
   where approval_request_id=p_request_id;
  insert into public.agent_security_events(organization_id,agent_key,event_type,severity,decision,reason,evidence)
  values(r.organization_id,r.requested_by_agent,'HUMAN_APPROVAL_DECISION',r.risk_tier,p_decision,coalesce(p_reason,''),jsonb_build_object('approval_request_id',r.id,'action_type',r.action_type,'tool_key',r.tool_key));
  return r;
end $$;
revoke all on function public.decide_thelma_approval(uuid,text,text) from public;
grant execute on function public.decide_thelma_approval(uuid,text,text) to authenticated;

create or replace function public.thelma_sync_repair_approval()
returns trigger language plpgsql security definer set search_path=public as $$
declare a uuid;
begin
  if new.human_approval_required and new.status in ('PROPOSED','READY','AWAITING_APPROVAL') then
    insert into public.thelma_approval_requests(organization_id,source_plan_id,requested_by_agent,action_type,risk_tier,title,description,tool_key,proposed_payload,status)
    values(new.organization_id,new.id,new.proposed_by,'REPAIR_EXECUTION',new.risk_tier,'Approve THELMA repair plan',new.problem_statement,'repair:execute',jsonb_build_object('steps',new.steps,'verification_plan',new.verification_plan,'required_capabilities',new.required_capabilities),'PENDING')
    on conflict (organization_id,source_plan_id) where source_plan_id is not null do update
      set title=excluded.title,description=excluded.description,proposed_payload=excluded.proposed_payload,updated_at=now()
    returning id into a;
    insert into public.thelma_alerts(organization_id,source_type,source_ref,system_key,severity,title,summary,recommended_action,approval_required,approval_request_id,evidence)
    values(new.organization_id,'REPAIR_PLAN',new.id::text,'SYS-THELMA-001',new.risk_tier,'THELMA needs your approval',new.problem_statement,'Review the repair, rollback, evidence, and risk before deciding.',true,a,jsonb_build_object('plan_key',new.plan_key,'proposed_by',new.proposed_by))
    on conflict (organization_id,source_type,source_ref) do update
      set summary=excluded.summary,approval_required=true,approval_request_id=excluded.approval_request_id,state='NEW',updated_at=now();
  end if;
  return new;
end $$;
drop trigger if exists sync_thelma_repair_approval on public.thelma_repair_plans;
create trigger sync_thelma_repair_approval after insert or update on public.thelma_repair_plans
for each row execute function public.thelma_sync_repair_approval();

create or replace function public.thelma_sync_wbc_alert()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.state not in ('RESOLVED','SUPPRESSED') then
    insert into public.thelma_alerts(organization_id,source_type,source_ref,system_key,severity,title,summary,recommended_action,approval_required,evidence)
    values(new.organization_id,'WHITE_BLOOD_CELL',new.id::text,new.system_key,lower(new.severity),new.title,new.summary,'Open THELMA, review evidence, and generate a repair plan.',false,jsonb_build_object('fingerprint',new.fingerprint,'recommended_agent',new.recommended_agent,'signal_type',new.signal_type))
    on conflict (organization_id,source_type,source_ref) do update
      set severity=excluded.severity,title=excluded.title,summary=excluded.summary,evidence=excluded.evidence,updated_at=now();
  else
    update public.thelma_alerts set state='RESOLVED',resolved_at=now(),updated_at=now()
     where organization_id=new.organization_id and source_type='WHITE_BLOOD_CELL' and source_ref=new.id::text;
  end if;
  return new;
end $$;
drop trigger if exists sync_thelma_wbc_alert on public.white_blood_cell_signals;
create trigger sync_thelma_wbc_alert after insert or update on public.white_blood_cell_signals
for each row execute function public.thelma_sync_wbc_alert();

insert into public.thelma_alerts(organization_id,source_type,source_ref,system_key,severity,title,summary,recommended_action,evidence)
select organization_id,'WHITE_BLOOD_CELL',id::text,system_key,lower(severity),title,summary,
       'Open THELMA, review evidence, and generate a repair plan.',
       jsonb_build_object('fingerprint',fingerprint,'recommended_agent',recommended_agent,'signal_type',signal_type)
from public.white_blood_cell_signals
where state not in ('RESOLVED','SUPPRESSED') and lower(severity) in ('high','critical')
on conflict (organization_id,source_type,source_ref) do nothing;

insert into public.orchestration_agents(organization_id,agent_key,display_name,operating_role,status,authority_scopes,health_percent,last_seen_at)
select id,'ECOSYSTEM_SCOUT','Ecosystem Scout','External capability discovery, ratings, usage signals, upstream changes and weekly advisements','online','["ecosystem:read","github:read","advisement:propose"]'::jsonb,100,now()
from public.ceo_organizations
on conflict (organization_id,agent_key) do update set display_name=excluded.display_name,operating_role=excluded.operating_role,status='online',authority_scopes=excluded.authority_scopes,updated_at=now();

insert into public.thelma_agent_profiles(organization_id,agent_key,parent_agent_key,agent_class,mission,specialties,default_model_route,repair_capabilities,autonomy_mode,operational_state,memory_scopes,tool_scopes,system_prompt_version)
select id,'ECOSYSTEM_SCOUT','THELMA','SPECIALIST','Monitor external tools, repositories, releases, usage evidence and ratings; prepare weekly evidence-backed advisements without installing anything.',array['upstream monitoring','repository scoring','provider changelogs','usage evidence','license precheck'],'balanced',array['discover','score','compare','advise'],'LOW_RISK_AUTONOMY','ACTIVE',array['analyst','capability_registry','source_provenance'],array['github:read','web:read','ecosystem:write'],'2026-08-25.v1'
from public.ceo_organizations
on conflict (organization_id,agent_key) do update set mission=excluded.mission,specialties=excluded.specialties,autonomy_mode=excluded.autonomy_mode,operational_state='ACTIVE',tool_scopes=excluded.tool_scopes,updated_at=now();

insert into public.agent_capability_grants(organization_id,agent_key,capability_key,tool_key,risk_tier,grant_state,requires_human_approval,allowed_memory_scopes,allowed_egress_domains,max_cost_cents,max_steps,max_runtime_seconds,approved_by,approval_evidence_ref,metadata)
select id,'ECOSYSTEM_SCOUT','ecosystem.discover','github:read','LOW','ACTIVE',false,array['analyst','capability_registry','source_provenance'],array['api.github.com','github.com'],100,50,240,'CEO_CANON','Master-System-Buildout/Ecosystem-Discovery-Learning-Engine',jsonb_build_object('boundary','read_score_advise_only','production_import','forbidden_without_ceo_approval')
from public.ceo_organizations
on conflict (organization_id,agent_key,capability_key,tool_key) do update set grant_state='ACTIVE',requires_human_approval=false,allowed_egress_domains=excluded.allowed_egress_domains,metadata=excluded.metadata,updated_at=now();

insert into public.ecosystem_watch_sources(organization_id,source_key,system_key,query_family,search_query,minimum_score)
select o.id,v.source_key,v.system_key,v.query_family,v.search_query,v.minimum_score
from public.ceo_organizations o cross join (values
 ('AGENT-RUNTIMES','SYS-THELMA-001','multi-agent orchestration','multi agent orchestration framework agents language:TypeScript stars:>100',70),
 ('AGENT-GOVERNANCE','SYS-THELMA-001','agent governance','AI agent governance guardrails evals stars:>50',65),
 ('DURABLE-WORKFLOWS','SYS-FABRIC-001','durable execution','durable workflow orchestration TypeScript stars:>100',65),
 ('CREATIVE-AI','SYS-VISION-001','creative media','AI video generation workflow open source stars:>100',65),
 ('PROPERTY-GIS','SYS-LAND-001','property GIS','open source GIS property intelligence stars:>50',60),
 ('GRANTS','SYS-GRANT-001','grant intelligence','grant management AI open source stars:>20',55),
 ('MARKETING-AGENTS','SYS-MKT-001','marketing intelligence','marketing automation AI agents open source stars:>100',65),
 ('DESIGN-SYSTEMS','SYS-DASH-001','design systems','Figma design system MCP agent stars:>20',55)
) as v(source_key,system_key,query_family,search_query,minimum_score)
on conflict (organization_id,source_key) do update set search_query=excluded.search_query,minimum_score=excluded.minimum_score,enabled=true,updated_at=now();

insert into public.thelma_plugin_registry(organization_id,plugin_key,display_name,provider,capability_class,integration_mode,transport,auth_strategy,connection_state,approval_policy,allowed_operations,prohibited_operations,credential_ref_name,endpoint,notes)
select o.id,v.* from public.ceo_organizations o cross join (values
 ('openai-models','OpenAI Models','OpenAI','reasoning + multimodal','Responses API','HTTPS','API key','MODEL_ACTIVE','ALWAYS_FOR_WRITE',array['reason','classify','draft','verify'],array['unapproved external write'],'OPENAI_API_KEY','https://api.openai.com/v1','THELMA model route; API access is separate from ChatGPT account plugins.'),
 ('codex-specialist','Codex Engineering Specialist','OpenAI','source-code engineering','Codex SDK / MCP specialist','MCP or server-side SDK','workload identity + scoped GitHub App','PLANNED','ALWAYS_FOR_WRITE',array['inspect repository','prepare patch','run tests','open pull request'],array['direct main write','merge without Quality Gate','broad personal token'],null,null,'Requires a sandboxed server-side executor; Codex is not inherited from this ChatGPT conversation.'),
 ('claude-models','Claude','Anthropic','reasoning + document/code review','Messages API / Agent SDK','HTTPS or MCP','API key + OAuth for MCP','MODEL_ACTIVE','ALWAYS_FOR_WRITE',array['reason','review','compare','draft'],array['unapproved external write'],'ANTHROPIC_API_KEY','https://api.anthropic.com','Claude model access is active; Claude Code execution is a separate sandboxed integration.'),
 ('figma','Figma','Figma','design context + canvas','Official Figma MCP','Streamable HTTP','OAuth','CHATGPT_ONLY','ALWAYS_FOR_WRITE',array['read design context','create approved design draft'],array['silent canvas write','publish without review'],null,'https://mcp.figma.com/mcp','Connected to ChatGPT, not yet authorized inside THELMA. Direct custom-client access depends on Figma MCP client support.'),
 ('github','GitHub','GitHub','source control','GitHub App','HTTPS','installation token','AWAITING_CREDENTIAL','ALWAYS_FOR_WRITE',array['read repository','create branch','open pull request','read checks'],array['direct main write','bypass branch protection','store broad PAT'],null,'https://api.github.com','Required for THELMA/Codex governed code repair.'),
 ('supabase','Supabase','Supabase','data + edge runtime','native runtime','HTTPS/Postgres','service role inside Edge only','ACTIVE','ALWAYS_FOR_WRITE',array['read governed memory','write audit evidence','run approved database workflow'],array['expose service key','bypass RLS from client'],null,null,'Canonical data and THELMA runtime.'),
 ('vercel','Vercel','Vercel','deployment + observability','REST/Git integration','HTTPS','scoped OAuth/token','PLANNED','ALWAYS_FOR_WRITE',array['read deployment status','read logs','verify preview'],array['deploy untested commit','promote without Quality Gate'],null,'https://api.vercel.com','Production deployment remains Git + Quality Gate governed.'),
 ('replit','Replit Logistics','Replit','logistics runtime','published app + Supabase contract','HTTPS','scoped app secrets','PLANNED','ALWAYS_FOR_WRITE',array['read logistics state','submit approved logistics workflow'],array['cross-tenant access','unapproved dispatch'],null,'https://rounded-lumpy-assembly--stevenhenry80.replit.app','Published; Supabase-authenticated logistics workflow still needs E2E certification.'),
 ('base44','Base44','Base44','alternate app runtime','deferred','OAuth','OAuth','DEFERRED','ALWAYS_FOR_WRITE',array[]::text[],array['block canonical build'],null,null,'Deferred by CEO; not on the critical path.')
) as v(plugin_key,display_name,provider,capability_class,integration_mode,transport,auth_strategy,connection_state,approval_policy,allowed_operations,prohibited_operations,credential_ref_name,endpoint,notes)
on conflict (organization_id,plugin_key) do update set connection_state=excluded.connection_state,approval_policy=excluded.approval_policy,allowed_operations=excluded.allowed_operations,prohibited_operations=excluded.prohibited_operations,endpoint=excluded.endpoint,notes=excluded.notes,updated_at=now();

do $$
begin
  if not exists(select 1 from vault.secrets where name='THELMA_ECOSYSTEM_CRON_SECRET') then
    perform vault.create_secret(encode(gen_random_bytes(32),'hex'),'THELMA_ECOSYSTEM_CRON_SECRET','THELMA weekly ecosystem scanner authentication');
  end if;
end $$;

create or replace function public.get_runtime_secret(p_name text)
returns text language sql security definer set search_path=public,vault as $$
  select decrypted_secret from vault.decrypted_secrets where name=p_name limit 1
$$;
revoke all on function public.get_runtime_secret(text) from public,anon,authenticated;
grant execute on function public.get_runtime_secret(text) to service_role;

do $$
declare j bigint;
begin
  select jobid into j from cron.job where jobname='thelma-ecosystem-weekly';
  if j is not null then perform cron.unschedule(j); end if;
  perform cron.schedule('thelma-ecosystem-weekly','0 13 * * 1',$cron$
    select net.http_post(
      url := 'https://yqealeekngxooyoemfba.supabase.co/functions/v1/ecosystem-watch',
      headers := jsonb_build_object('content-type','application/json','x-thelma-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='THELMA_ECOSYSTEM_CRON_SECRET' limit 1)),
      body := jsonb_build_object('trigger','weekly_cron')
    );
  $cron$);
end $$;

insert into public.analyst_memory(organization_id,memory_key,system_key,category,title,summary,body,memory_state,trust_level,source_ref,provenance,tags,effective_at)
select id,'THELMA-ALERT-APPROVAL-ECOSYSTEM-CONTRACT','SYS-THELMA-001','OPERATING_DOCTRINE','THELMA alerts, CEO approvals and weekly ecosystem intelligence','THELMA must alert the CEO, pause governed work for approval, and lead a weekly evidence-backed review of external updates, ratings and usage signals.','White Blood Cells and repair plans create executive alerts. Side effects remain approval-gated. Ecosystem Scout may read, score and advise automatically but may not install, import, deploy or change permissions. Plugin connections in ChatGPT do not automatically become THELMA runtime credentials.','ACTIVE_CANON','VERIFIED','Master-System-Buildout/02-SYSTEM-SPECIFICATIONS/Ecosystem-Discovery-Learning-Engine/README.md',jsonb_build_object('implemented_by','20260825223000_thelma_alerts_ecosystem_plugins.sql','reviewed_on','2026-08-25'),array['thelma','alerts','approval','ecosystem','plugins','weekly'],now()
from public.ceo_organizations
on conflict (organization_id,memory_key) do update set summary=excluded.summary,body=excluded.body,memory_state='ACTIVE_CANON',trust_level='VERIFIED',updated_at=now();

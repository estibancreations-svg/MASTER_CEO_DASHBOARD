-- Analyst Memory Bank: canonical reconstruction findings, evidence, repair footprints and durable analysis.
create table if not exists public.analyst_memory (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  memory_key text not null, system_key text, category text not null, title text not null, summary text not null, body text not null,
  memory_state text not null default 'ACTIVE_CANON' check (memory_state in ('ACTIVE_CANON','SUPERSEDED','HISTORICAL','EXPERIMENTAL','QUARANTINED','DUPLICATE','REJECTED')),
  trust_level text not null default 'VERIFIED' check (trust_level in ('VERIFIED','INFERRED','UNVERIFIED')), source_ref text,
  provenance jsonb not null default '{}'::jsonb, tags text[] not null default '{}'::text[], effective_at timestamptz not null default now(),
  superseded_by uuid references public.analyst_memory(id), created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,memory_key)
);
create table if not exists public.analyst_findings (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  finding_key text not null, system_key text, domain text not null default 'enterprise', title text not null, description text not null, finding_type text not null,
  severity text not null default 'medium' check (severity in ('critical','high','medium','low','info')),
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','BLOCKED','FIXED','VERIFIED','SUPERSEDED','NOT_APPLICABLE')),
  priority integer not null default 50 check (priority between 0 and 100), current_state text, desired_state text, remediation_plan text, owner text,
  blocking_dependency text, related_memory_key text, source_ref text, discovered_at timestamptz not null default now(), corrected_at timestamptz,
  verified_at timestamptz, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,finding_key)
);
create table if not exists public.analyst_evidence (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  finding_id uuid references public.analyst_findings(id) on delete cascade, memory_id uuid references public.analyst_memory(id) on delete cascade,
  evidence_type text not null, source_system text not null, source_ref text not null, release_ref text,
  evidence_state text not null default 'CURRENT' check (evidence_state in ('CURRENT','STALE','SUPERSEDED','UNVERIFIED')),
  summary text not null, payload jsonb not null default '{}'::jsonb, observed_at timestamptz not null default now(), created_at timestamptz not null default now(),
  check (finding_id is not null or memory_id is not null)
);
create table if not exists public.analyst_actions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  finding_id uuid references public.analyst_findings(id) on delete set null, action_key text not null, action_type text not null,
  status text not null default 'PLANNED' check (status in ('PLANNED','RUNNING','BLOCKED','COMPLETED','VERIFIED','FAILED')),
  summary text not null, actor text, commit_sha text, migration_version text, deployment_id text, test_ref text, metadata jsonb not null default '{}'::jsonb,
  executed_at timestamptz, verified_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,action_key)
);
create table if not exists public.analyst_system_index (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  system_key text not null, display_name text not null, system_class text not null default 'application', canonical_state text not null default 'RECONSTRUCTION',
  runtime_state text not null default 'UNKNOWN', source_of_truth text, dashboard_route text, notes text, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,system_key)
);
create index if not exists analyst_findings_status_idx on public.analyst_findings(organization_id,status,severity,priority desc);
create index if not exists analyst_findings_system_idx on public.analyst_findings(organization_id,system_key,status);
create index if not exists analyst_evidence_finding_idx on public.analyst_evidence(finding_id,observed_at desc);
create index if not exists analyst_actions_finding_idx on public.analyst_actions(finding_id,executed_at desc);
create index if not exists analyst_memory_system_idx on public.analyst_memory(organization_id,system_key,memory_state);
alter table public.analyst_memory enable row level security; alter table public.analyst_findings enable row level security; alter table public.analyst_evidence enable row level security; alter table public.analyst_actions enable row level security; alter table public.analyst_system_index enable row level security;
do $$ declare t text; begin
  foreach t in array array['analyst_memory','analyst_findings','analyst_evidence','analyst_actions','analyst_system_index'] loop
    execute format('create policy %I on public.%I for select to authenticated using (exists (select 1 from public.ceo_organization_memberships m where m.organization_id = organization_id and m.user_id = (select auth.uid()) and m.status = ''active''))',t||'_member_select',t);
    execute format('create policy %I on public.%I for insert to authenticated with check (exists (select 1 from public.ceo_organization_memberships m where m.organization_id = organization_id and m.user_id = (select auth.uid()) and m.status = ''active''))',t||'_member_insert',t);
    execute format('create policy %I on public.%I for update to authenticated using (exists (select 1 from public.ceo_organization_memberships m where m.organization_id = organization_id and m.user_id = (select auth.uid()) and m.status = ''active'')) with check (exists (select 1 from public.ceo_organization_memberships m where m.organization_id = organization_id and m.user_id = (select auth.uid()) and m.status = ''active''))',t||'_member_update',t);
    execute format('create policy %I on public.%I for delete to authenticated using (exists (select 1 from public.ceo_organization_memberships m where m.organization_id = organization_id and m.user_id = (select auth.uid()) and m.status = ''active''))',t||'_member_delete',t);
  end loop;
end $$;
grant select,insert,update,delete on public.analyst_memory,public.analyst_findings,public.analyst_evidence,public.analyst_actions,public.analyst_system_index to authenticated;
grant all on public.analyst_memory,public.analyst_findings,public.analyst_evidence,public.analyst_actions,public.analyst_system_index to service_role;
create or replace view public.analyst_system_rollup with (security_invoker=true) as
select s.organization_id,s.system_key,s.display_name,s.system_class,s.canonical_state,s.runtime_state,s.dashboard_route,
 count(f.id) filter(where f.status in ('OPEN','IN_PROGRESS','BLOCKED')) open_findings,
 count(f.id) filter(where f.status in ('FIXED','VERIFIED')) corrected_findings,
 count(f.id) filter(where f.severity='critical' and f.status in ('OPEN','IN_PROGRESS','BLOCKED')) critical_open,
 max(coalesce(f.verified_at,f.corrected_at,f.updated_at)) last_finding_activity
from public.analyst_system_index s left join public.analyst_findings f on f.organization_id=s.organization_id and f.system_key=s.system_key
group by s.organization_id,s.system_key,s.display_name,s.system_class,s.canonical_state,s.runtime_state,s.dashboard_route;
grant select on public.analyst_system_rollup to authenticated,service_role;

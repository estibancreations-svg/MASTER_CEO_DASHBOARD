create table if not exists public.analyst_capabilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  capability_key text not null,
  source_title text not null,
  source_ref text not null,
  source_scope text not null,
  source_order integer not null,
  requirement_type text not null check (requirement_type in ('CORE_MODULE','INTEGRATION','EXPANSION','ARCHITECTURE')),
  requirement_text text not null,
  canonical_system_key text,
  canonical_module_key text,
  disposition text not null default 'NEEDS_ARCHITECT_DECISION' check (disposition in ('REQUIRED_ACTIVE','REQUIRED_LATER_PHASE','SUPERSEDED_BY_BETTER_DESIGN','REJECTED_WITH_RATIONALE','DUPLICATE','EXTERNAL_DEPENDENCY','NEEDS_ARCHITECT_DECISION')),
  implementation_state text not null default 'UNMAPPED' check (implementation_state in ('UNMAPPED','MISSING','PARTIAL','IMPLEMENTED','VERIFIED','BLOCKED')),
  rationale text,
  evidence jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,capability_key)
);
create index if not exists analyst_capabilities_system_idx on public.analyst_capabilities(organization_id,canonical_system_key,implementation_state);
create index if not exists analyst_capabilities_disposition_idx on public.analyst_capabilities(organization_id,disposition,implementation_state);
alter table public.analyst_capabilities enable row level security;
create policy analyst_capabilities_member_select on public.analyst_capabilities for select to authenticated using (exists(select 1 from public.ceo_organization_memberships m where m.organization_id=organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy analyst_capabilities_member_insert on public.analyst_capabilities for insert to authenticated with check (exists(select 1 from public.ceo_organization_memberships m where m.organization_id=organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy analyst_capabilities_member_update on public.analyst_capabilities for update to authenticated using (exists(select 1 from public.ceo_organization_memberships m where m.organization_id=organization_id and m.user_id=(select auth.uid()) and m.status='active')) with check (exists(select 1 from public.ceo_organization_memberships m where m.organization_id=organization_id and m.user_id=(select auth.uid()) and m.status='active'));
grant select,insert,update on public.analyst_capabilities to authenticated;
grant all on public.analyst_capabilities to service_role;
create or replace view public.analyst_capability_rollup with (security_invoker=true) as
select organization_id,source_scope,requirement_type,disposition,implementation_state,count(*) capability_count
from public.analyst_capabilities group by organization_id,source_scope,requirement_type,disposition,implementation_state;
grant select on public.analyst_capability_rollup to authenticated,service_role;

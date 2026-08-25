create table if not exists public.agent_security_threats (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  threat_key text not null, threat_name text not null, attack_vector text not null, potential_impact text not null,
  severity text not null check(severity in ('critical','high','medium','low')), required_controls jsonb not null default '[]'::jsonb,
  implementation_state text not null default 'REQUIRED' check(implementation_state in ('REQUIRED','PARTIAL','IMPLEMENTED','VERIFIED')),
  evidence_ref text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,threat_key)
);
create table if not exists public.agent_capability_grants (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  agent_key text not null, capability_key text not null, tool_key text not null default '*', risk_tier text not null default 'HIGH' check(risk_tier in ('LOW','MEDIUM','HIGH','CRITICAL')),
  grant_state text not null default 'DISABLED' check(grant_state in ('DISABLED','SANDBOX','ACTIVE','SUSPENDED','REVOKED')),
  requires_human_approval boolean not null default true, allowed_memory_scopes text[] not null default '{}'::text[], allowed_egress_domains text[] not null default '{}'::text[],
  max_cost_cents integer check(max_cost_cents is null or max_cost_cents>=0), max_steps integer not null default 12 check(max_steps between 1 and 500),
  max_runtime_seconds integer not null default 120 check(max_runtime_seconds between 1 and 3600), expires_at timestamptz, approved_by text, approval_evidence_ref text,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,agent_key,capability_key,tool_key)
);
create table if not exists public.agent_security_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  agent_key text, threat_key text, event_type text not null, severity text not null check(severity in ('critical','high','medium','low','info')),
  decision text not null check(decision in ('ALLOW','DENY','SANDBOX','ESCALATE','STOP')), reason text not null, correlation_id uuid,
  evidence jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists agent_grants_lookup_idx on public.agent_capability_grants(organization_id,agent_key,capability_key,grant_state);
create index if not exists agent_security_events_time_idx on public.agent_security_events(organization_id,created_at desc);
alter table public.agent_security_threats enable row level security; alter table public.agent_capability_grants enable row level security; alter table public.agent_security_events enable row level security;
create policy agent_security_threats_member_select on public.agent_security_threats for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy agent_capability_grants_member_select on public.agent_capability_grants for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy agent_security_events_member_select on public.agent_security_events for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=organization_id and m.user_id=(select auth.uid()) and m.status='active'));
grant select on public.agent_security_threats,public.agent_capability_grants,public.agent_security_events to authenticated; grant all on public.agent_security_threats,public.agent_capability_grants,public.agent_security_events to service_role;
create or replace function public.agent_capability_is_active(p_organization_id uuid,p_agent_key text,p_capability_key text,p_tool_key text default '*') returns boolean language sql stable security invoker as $$
 select exists(select 1 from public.agent_capability_grants g where g.organization_id=p_organization_id and g.agent_key=p_agent_key and g.capability_key=p_capability_key and g.grant_state='ACTIVE' and (g.tool_key=p_tool_key or g.tool_key='*') and (g.expires_at is null or g.expires_at>now()));
$$;
revoke all on function public.agent_capability_is_active(uuid,text,text,text) from public,anon; grant execute on function public.agent_capability_is_active(uuid,text,text,text) to authenticated,service_role;

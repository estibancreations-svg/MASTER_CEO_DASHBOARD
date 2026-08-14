-- Step 1: Control Plane and Identity
-- Applied to yqealeekngxooyoemfba as ceo_control_plane_identity_tenancy_20260814.
begin;
create table if not exists public.ceo_organizations(
 id uuid primary key default gen_random_uuid(),slug text not null unique,display_name text not null,
 created_by uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.ceo_organization_memberships(
 organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in('architect','ceo','delegated_approver','operator','auditor','viewer')),
 status text not null default'active' check(status in('active','suspended','revoked')),
 scopes jsonb not null default'[]',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(organization_id,user_id));
alter table public.ceo_organizations enable row level security;
alter table public.ceo_organization_memberships enable row level security;
create policy "members read own membership" on public.ceo_organization_memberships for select to authenticated using((select auth.uid())=user_id);
create policy "members read organization" on public.ceo_organizations for select to authenticated using(exists(
 select 1 from public.ceo_organization_memberships m where m.organization_id=id and m.user_id=(select auth.uid()) and m.status='active'));
insert into public.ceo_organizations(slug,display_name,created_by)
select'estiban-creations','Estiban Creations',id from auth.users where lower(email)=lower('estibancreations@gmail.com')
on conflict(slug)do update set display_name=excluded.display_name,updated_at=now();
insert into public.ceo_organization_memberships(organization_id,user_id,role,status,scopes)
select o.id,u.id,'architect','active','["*"]' from public.ceo_organizations o cross join auth.users u
where o.slug='estiban-creations'and lower(u.email)=lower('estibancreations@gmail.com')
on conflict(organization_id,user_id)do update set role='architect',status='active',scopes='["*"]',updated_at=now();
alter table public.ceo_system_status add column if not exists organization_id uuid references public.ceo_organizations(id);
alter table public.ceo_integrations add column if not exists organization_id uuid references public.ceo_organizations(id);
alter table public.ceo_decisions add column if not exists organization_id uuid references public.ceo_organizations(id);
alter table public.ceo_audit_events add column if not exists organization_id uuid references public.ceo_organizations(id);
update public.ceo_system_status set organization_id=o.id from public.ceo_organizations o where organization_id is null and o.slug='estiban-creations';
update public.ceo_integrations set organization_id=o.id from public.ceo_organizations o where organization_id is null and o.slug='estiban-creations';
update public.ceo_decisions set organization_id=o.id from public.ceo_organizations o where organization_id is null and o.slug='estiban-creations';
update public.ceo_audit_events set organization_id=o.id from public.ceo_organizations o where organization_id is null and o.slug='estiban-creations';
alter table public.ceo_system_status alter column organization_id set not null;
alter table public.ceo_integrations alter column organization_id set not null;
alter table public.ceo_decisions alter column organization_id set not null;
alter table public.ceo_audit_events alter column organization_id set not null;
alter table public.ceo_system_status drop constraint if exists ceo_system_status_pkey;
alter table public.ceo_system_status add constraint ceo_system_status_pkey primary key(organization_id,system_id);
alter table public.ceo_integrations drop constraint if exists ceo_integrations_pkey;
alter table public.ceo_integrations add constraint ceo_integrations_pkey primary key(organization_id,integration_key);
alter table public.ceo_decisions add column if not exists correlation_id uuid not null default gen_random_uuid();
alter table public.ceo_decisions add column if not exists requested_by uuid references auth.users(id);
alter table public.ceo_decisions add column if not exists risk_level text not null default'medium';
alter table public.ceo_decisions add column if not exists authorization_state text not null default'ASK';
alter table public.ceo_decisions drop constraint if exists ceo_decisions_risk_level_check;
alter table public.ceo_decisions add constraint ceo_decisions_risk_level_check check(risk_level in('low','medium','high','critical'));
alter table public.ceo_decisions drop constraint if exists ceo_decisions_authorization_state_check;
alter table public.ceo_decisions add constraint ceo_decisions_authorization_state_check check(authorization_state in('ASK','AUTHORIZED','REJECTED','EXECUTED','FAILED'));
alter table public.ceo_audit_events add column if not exists correlation_id uuid not null default gen_random_uuid();
alter table public.ceo_audit_events add column if not exists causation_id uuid;
alter table public.ceo_audit_events add column if not exists risk_level text not null default'low';
alter table public.ceo_audit_events add column if not exists authorization_state text not null default'ASK';
alter table public.ceo_audit_events drop constraint if exists ceo_audit_events_risk_level_check;
alter table public.ceo_audit_events add constraint ceo_audit_events_risk_level_check check(risk_level in('low','medium','high','critical'));
alter table public.ceo_audit_events drop constraint if exists ceo_audit_events_authorization_state_check;
alter table public.ceo_audit_events add constraint ceo_audit_events_authorization_state_check check(authorization_state in('ASK','AUTHORIZED','REJECTED','EXECUTED','FAILED'));
create table if not exists public.ceo_governed_actions(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.ceo_organizations(id),
 correlation_id uuid not null default gen_random_uuid(),causation_id uuid,actor_id uuid not null references auth.users(id),
 action_type text not null,target_system text not null,risk_level text not null default'medium' check(risk_level in('low','medium','high','critical')),
 authorization_state text not null default'ASK' check(authorization_state in('ASK','AUTHORIZED','REJECTED','EXECUTED','FAILED')),
 payload_reference jsonb not null default'{}',audit_event_id bigint references public.ceo_audit_events(id),
 execution_status text,execution_time_ms integer check(execution_time_ms is null or execution_time_ms>=0),
 usage_cost numeric(12,4)check(usage_cost is null or usage_cost>=0),error_summary text,
 authorized_by uuid references auth.users(id),authorized_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.ceo_governed_actions enable row level security;
create policy "members read governed actions" on public.ceo_governed_actions for select to authenticated using(exists(
 select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_governed_actions.organization_id and m.user_id=(select auth.uid())and m.status='active'));
create policy "members request governed actions" on public.ceo_governed_actions for insert to authenticated with check(
 actor_id=(select auth.uid())and authorization_state='ASK'and exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_governed_actions.organization_id and m.user_id=(select auth.uid())and m.status='active'));
create policy "architect authorizes governed actions" on public.ceo_governed_actions for update to authenticated
using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_governed_actions.organization_id and m.user_id=(select auth.uid())and m.status='active'and(m.role='architect'or(m.role='delegated_approver'and ceo_governed_actions.risk_level not in('high','critical')))))
with check(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_governed_actions.organization_id and m.user_id=(select auth.uid())and m.status='active'and(m.role='architect'or(m.role='delegated_approver'and ceo_governed_actions.risk_level not in('high','critical')))));
drop policy if exists ceo_read_system_status on public.ceo_system_status;drop policy if exists ceo_write_system_status on public.ceo_system_status;
create policy ceo_read_system_status on public.ceo_system_status for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_system_status.organization_id and m.user_id=(select auth.uid())and m.status='active'));
create policy ceo_write_system_status on public.ceo_system_status for all to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_system_status.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role='architect'))with check(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_system_status.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role='architect'));
drop policy if exists ceo_read_integrations on public.ceo_integrations;drop policy if exists ceo_write_integrations on public.ceo_integrations;
create policy ceo_read_integrations on public.ceo_integrations for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_integrations.organization_id and m.user_id=(select auth.uid())and m.status='active'));
create policy ceo_write_integrations on public.ceo_integrations for all to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_integrations.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role='architect'))with check(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_integrations.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role='architect'));
drop policy if exists ceo_read_decisions on public.ceo_decisions;drop policy if exists ceo_write_decisions on public.ceo_decisions;
create policy ceo_read_decisions on public.ceo_decisions for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_decisions.organization_id and m.user_id=(select auth.uid())and m.status='active'));
create policy ceo_write_decisions on public.ceo_decisions for all to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_decisions.organization_id and m.user_id=(select auth.uid())and m.status='active'and(m.role='architect'or(m.role='delegated_approver'and ceo_decisions.risk_level not in('high','critical')))))with check(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_decisions.organization_id and m.user_id=(select auth.uid())and m.status='active'and(m.role='architect'or(m.role='delegated_approver'and ceo_decisions.risk_level not in('high','critical')))));
drop policy if exists ceo_read_audit on public.ceo_audit_events;drop policy if exists ceo_insert_audit on public.ceo_audit_events;
create policy ceo_read_audit on public.ceo_audit_events for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_audit_events.organization_id and m.user_id=(select auth.uid())and m.status='active'));
create policy ceo_insert_audit on public.ceo_audit_events for insert to authenticated with check(actor_id=(select auth.uid())and exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_audit_events.organization_id and m.user_id=(select auth.uid())and m.status='active'));
create index if not exists ceo_memberships_user_idx on public.ceo_organization_memberships(user_id,status);
create index if not exists ceo_system_status_org_idx on public.ceo_system_status(organization_id);
create index if not exists ceo_integrations_org_idx on public.ceo_integrations(organization_id);
create index if not exists ceo_decisions_org_idx on public.ceo_decisions(organization_id,status,due_at);
create index if not exists ceo_audit_org_idx on public.ceo_audit_events(organization_id,created_at desc);
create index if not exists ceo_actions_org_idx on public.ceo_governed_actions(organization_id,authorization_state,created_at desc);
commit;

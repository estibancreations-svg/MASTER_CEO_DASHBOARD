-- Section 6: THELMA command plane, n8n run registry, incidents and usage telemetry.
begin;
create table if not exists public.orchestration_agents(
 organization_id uuid not null references public.ceo_organizations(id) on delete cascade,agent_key text not null,display_name text not null,
 operating_role text not null,status text not null default'idle' check(status in('online','idle','busy','degraded','offline')),
 authority_scopes jsonb not null default '[]',health_percent integer not null default 100 check(health_percent between 0 and 100),
 last_seen_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(organization_id,agent_key));
create table if not exists public.orchestration_commands(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
 correlation_id uuid not null default gen_random_uuid(),causation_id uuid,requested_by uuid references auth.users(id),
 source_system text not null default'SYS-CEO-001',target_agent text not null,action_type text not null,
 risk_level text not null default'medium' check(risk_level in('low','medium','high','critical')),
 authorization_state text not null default'ASK' check(authorization_state in('ASK','AUTHORIZED','REJECTED','EXECUTED','FAILED')),
 execution_status text not null default'queued' check(execution_status in('queued','dispatched','running','completed','blocked','failed','cancelled')),
 payload_reference jsonb not null default'{}',result_reference jsonb not null default'{}',audit_event_id bigint references public.ceo_audit_events(id),
 authorized_by uuid references auth.users(id),authorized_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.orchestration_runs(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
 command_id uuid references public.orchestration_commands(id) on delete set null,workflow_key text not null,engine text not null default'n8n',
 trigger_type text not null,status text not null check(status in('queued','running','succeeded','degraded','failed','cancelled')),
 attempt integer not null default 1,duration_ms integer,usage_cost numeric(12,4),error_summary text,started_at timestamptz,completed_at timestamptz,
 created_at timestamptz not null default now());
create table if not exists public.orchestration_incidents(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
 correlation_id uuid not null default gen_random_uuid(),system_key text not null,severity text not null check(severity in('info','low','medium','high','critical')),
 title text not null,status text not null default'open' check(status in('open','investigating','contained','resolved','accepted')),
 detection_source text not null,remediation_summary text,owner_agent text,opened_at timestamptz not null default now(),resolved_at timestamptz);
create index if not exists orchestration_commands_queue_idx on public.orchestration_commands(organization_id,execution_status,created_at);
create index if not exists orchestration_runs_status_idx on public.orchestration_runs(organization_id,status,created_at);
create index if not exists orchestration_incidents_status_idx on public.orchestration_incidents(organization_id,status,severity);
alter table public.orchestration_agents enable row level security;alter table public.orchestration_commands enable row level security;alter table public.orchestration_runs enable row level security;alter table public.orchestration_incidents enable row level security;
create policy "members read orchestration agents" on public.orchestration_agents for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=orchestration_agents.organization_id and m.user_id=(select auth.uid())and m.status='active'));
create policy "architect manages orchestration agents" on public.orchestration_agents for all to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=orchestration_agents.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role='architect'))with check(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=orchestration_agents.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role='architect'));
create policy "members read orchestration commands" on public.orchestration_commands for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=orchestration_commands.organization_id and m.user_id=(select auth.uid())and m.status='active'));
create policy "members request orchestration commands" on public.orchestration_commands for insert to authenticated with check(requested_by=(select auth.uid())and authorization_state='ASK'and execution_status='queued'and exists(select 1 from public.ceo_organization_memberships m where m.organization_id=orchestration_commands.organization_id and m.user_id=(select auth.uid())and m.status='active'));
create policy "architect authorizes orchestration commands" on public.orchestration_commands for update to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=orchestration_commands.organization_id and m.user_id=(select auth.uid())and m.status='active'and(m.role='architect'or(m.role='delegated_approver'and orchestration_commands.risk_level not in('high','critical')))))with check(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=orchestration_commands.organization_id and m.user_id=(select auth.uid())and m.status='active'and(m.role='architect'or(m.role='delegated_approver'and orchestration_commands.risk_level not in('high','critical')))));
create policy "members read orchestration runs" on public.orchestration_runs for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=orchestration_runs.organization_id and m.user_id=(select auth.uid())and m.status='active'));
create policy "architect manages orchestration runs" on public.orchestration_runs for all to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=orchestration_runs.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role='architect'))with check(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=orchestration_runs.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role='architect'));
create policy "members read orchestration incidents" on public.orchestration_incidents for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=orchestration_incidents.organization_id and m.user_id=(select auth.uid())and m.status='active'));
create policy "operators manage orchestration incidents" on public.orchestration_incidents for all to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=orchestration_incidents.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role in('architect','ceo','operator','auditor')))with check(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=orchestration_incidents.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role in('architect','ceo','operator','auditor')));
with o as(select id from public.ceo_organizations where slug='estiban-creations')
insert into public.orchestration_agents(organization_id,agent_key,display_name,operating_role,status,authority_scopes,health_percent,last_seen_at)
select o.id,x.agent_key,x.display_name,x.operating_role,x.status,x.scopes::jsonb,x.health,now() from o cross join(values
 ('THELMA','THELMA','Operations lead and governed dispatcher','online','["dispatch","monitor","brief"]',96),
 ('AUDITOR','The Auditor','Quality control and evidence review','online','["inspect","reject","certify"]',98),
 ('CMGIO','CMGIO','Marketing and growth intelligence','idle','["analyze","recommend","optimize"]',94),
 ('LANDWEAVER','LandWeaver','Property intelligence worker','idle','["screen","assess","brief"]',92),
 ('VISIONWEAVER','VisionWeaver','Creative production worker','degraded','["plan","render","qc"]',72))x(agent_key,display_name,operating_role,status,scopes,health)
on conflict(organization_id,agent_key)do update set status=excluded.status,authority_scopes=excluded.authority_scopes,health_percent=excluded.health_percent,last_seen_at=excluded.last_seen_at,updated_at=now();
with o as(select id from public.ceo_organizations where slug='estiban-creations')
insert into public.orchestration_runs(organization_id,workflow_key,engine,trigger_type,status,attempt,duration_ms,usage_cost,started_at,completed_at)
select o.id,x.key,'n8n',x.trigger,x.status,1,x.ms,x.cost,now()-x.age,now()-x.age+(x.ms||' milliseconds')::interval from o cross join(values
 ('daily-executive-briefing','schedule','succeeded',8420,0.0310,interval'18 minutes'),
 ('system-health-pulse','schedule','succeeded',2140,0.0040,interval'8 minutes'),
 ('visionweaver-provider-check','schedule','degraded',1280,0.0010,interval'3 minutes'))x(key,trigger,status,ms,cost,age)
where not exists(select 1 from public.orchestration_runs r where r.organization_id=o.id and r.workflow_key=x.key);
insert into public.ceo_system_status(organization_id,system_id,system_name,lifecycle_state,health_state,progress_percent,source_system,source_updated_at,blocker_count,qc_state,summary)
select o.id,'SYS-THELMA-001','THELMA / n8n','mvp','healthy',88,'THELMA',now(),1,'passed','Governed command queue, agent registry, n8n run telemetry and white-blood-cell incident model are active. External n8n execution endpoint remains deferred to the API run.' from public.ceo_organizations o where o.slug='estiban-creations'
on conflict(organization_id,system_id)do update set lifecycle_state=excluded.lifecycle_state,health_state=excluded.health_state,progress_percent=excluded.progress_percent,blocker_count=excluded.blocker_count,qc_state=excluded.qc_state,summary=excluded.summary,updated_at=now();
commit;

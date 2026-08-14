-- Section 5: GrantOS operating model, pipeline, marker slots and governed submission state.
begin;
create table if not exists public.grant_opportunities(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
 title text not null,funder text not null,program text,external_ref text,source_url text,source_class text not null default'user_entered',
 amount_min numeric(14,2),amount_max numeric(14,2),deadline timestamptz,eligibility_summary text,match_required boolean,
 status text not null default'review' check(status in('discovered','review','qualified','declined','archived')),
 created_by uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.grant_applications(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
 opportunity_id uuid references public.grant_opportunities(id) on delete set null,title text not null,
 stage text not null default'Prospecting' check(stage in('Prospecting','In Review','Drafting','Submitted','Active-Funded','Graveyard')),
 requested_amount numeric(14,2),due_at timestamptz,completion_percent integer not null default 0 check(completion_percent between 0 and 100),
 risk_level text not null default'medium' check(risk_level in('low','medium','high','critical')),
 authorization_state text not null default'ASK' check(authorization_state in('ASK','AUTHORIZED','REJECTED','EXECUTED','FAILED')),
 owner_id uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.grant_requirements(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
 application_id uuid not null references public.grant_applications(id) on delete cascade,label text not null,
 slot_state text not null default'Empty' check(slot_state in('Empty','Pending','Verified')),required boolean not null default true,
 evidence_reference jsonb not null default'{}',due_at timestamptz,sort_order integer not null default 100,updated_at timestamptz not null default now());
create table if not exists public.grant_budget_items(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
 application_id uuid not null references public.grant_applications(id) on delete cascade,category text not null,description text not null,
 requested_amount numeric(14,2) not null default 0,match_amount numeric(14,2) not null default 0,source_class text not null default'user_entered',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists grant_opportunities_org_deadline_idx on public.grant_opportunities(organization_id,deadline);
create index if not exists grant_applications_org_stage_idx on public.grant_applications(organization_id,stage,due_at);
create index if not exists grant_requirements_application_idx on public.grant_requirements(application_id,sort_order);
create index if not exists grant_budget_application_idx on public.grant_budget_items(application_id);
alter table public.grant_opportunities enable row level security;
alter table public.grant_applications enable row level security;
alter table public.grant_requirements enable row level security;
alter table public.grant_budget_items enable row level security;
create policy "members read grant opportunities" on public.grant_opportunities for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=grant_opportunities.organization_id and m.user_id=(select auth.uid())and m.status='active'));
create policy "operators manage grant opportunities" on public.grant_opportunities for all to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=grant_opportunities.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role in('architect','ceo','operator')))with check(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=grant_opportunities.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role in('architect','ceo','operator')));
create policy "members read grant applications" on public.grant_applications for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=grant_applications.organization_id and m.user_id=(select auth.uid())and m.status='active'));
create policy "operators create grant applications" on public.grant_applications for insert to authenticated with check(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=grant_applications.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role in('architect','ceo','operator'))and authorization_state='ASK');
create policy "architect governs grant applications" on public.grant_applications for update to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=grant_applications.organization_id and m.user_id=(select auth.uid())and m.status='active'and(m.role='architect'or(m.role in('ceo','delegated_approver','operator')and grant_applications.risk_level not in('high','critical')))))with check(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=grant_applications.organization_id and m.user_id=(select auth.uid())and m.status='active'and(m.role='architect'or(m.role in('ceo','delegated_approver','operator')and grant_applications.risk_level not in('high','critical')))));
create policy "members read grant requirements" on public.grant_requirements for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=grant_requirements.organization_id and m.user_id=(select auth.uid())and m.status='active'));
create policy "operators manage grant requirements" on public.grant_requirements for all to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=grant_requirements.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role in('architect','ceo','operator')))with check(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=grant_requirements.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role in('architect','ceo','operator')));
create policy "members read grant budgets" on public.grant_budget_items for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=grant_budget_items.organization_id and m.user_id=(select auth.uid())and m.status='active'));
create policy "operators manage grant budgets" on public.grant_budget_items for all to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=grant_budget_items.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role in('architect','ceo','operator')))with check(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=grant_budget_items.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role in('architect','ceo','operator')));
with o as(select id,created_by from public.ceo_organizations where slug='estiban-creations'),seed(title,funder,program,amount_min,amount_max,deadline,eligibility_summary,match_required,status)as(values
 ('Community Facilities Innovation Grant','U.S. Department of Agriculture','Community Facilities',25000,500000,'2026-09-18'::timestamptz,'Rural community-serving facilities; eligibility requires source verification.',false,'qualified'),
 ('Creative Workforce Development RFP','Southeast Arts Collaborative','Workforce & Media',50000,250000,'2026-10-02'::timestamptz,'Regional creative-workforce programs with measurable outcomes.',true,'review'),
 ('Coastal Resilience Planning Award','Regional Resilience Foundation','Climate Resilience',75000,400000,'2026-10-21'::timestamptz,'Planning and community resilience projects in eligible coastal markets.',false,'review'))
insert into public.grant_opportunities(organization_id,title,funder,program,amount_min,amount_max,deadline,eligibility_summary,match_required,status,source_class,created_by)
select o.id,s.title,s.funder,s.program,s.amount_min,s.amount_max,s.deadline,s.eligibility_summary,s.match_required,s.status,'synthetic',o.created_by from o cross join seed s
where not exists(select 1 from public.grant_opportunities g where g.organization_id=o.id and g.title=s.title);
insert into public.grant_applications(organization_id,opportunity_id,title,stage,requested_amount,due_at,completion_percent,risk_level,authorization_state,owner_id)
select g.organization_id,g.id,g.title,case when g.status='qualified' then 'Drafting' else 'In Review' end,coalesce(g.amount_max,g.amount_min),g.deadline,case when g.status='qualified' then 62 else 28 end,'high','ASK',g.created_by from public.grant_opportunities g
where g.source_class='synthetic'and not exists(select 1 from public.grant_applications a where a.organization_id=g.organization_id and a.opportunity_id=g.id);
insert into public.grant_requirements(organization_id,application_id,label,slot_state,sort_order)
select a.organization_id,a.id,x.label,x.state,x.sort from public.grant_applications a cross join(values('Eligibility evidence','Verified',10),('Narrative draft','Pending',20),('Budget and match','Pending',30),('Authority and certifications','Empty',40),('Submission package','Empty',50))x(label,state,sort)
where not exists(select 1 from public.grant_requirements r where r.application_id=a.id);
update public.ceo_system_status set lifecycle_state='mvp',progress_percent=82,health_state='healthy',qc_state='passed',blocker_count=1,
 summary='Operational pipeline, marker slots, budgets, governed authority and synthetic launch portfolio are active. External discovery and submission adapters remain deferred to the API-key run.'
where system_id='SYS-GRANT-001';
commit;

-- Step 2: dynamic operating records for every Master Dashboard module.
begin;
create table if not exists public.ceo_module_records(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
 module_key text not null,name text not null,category text not null default'General',status_value text not null default'Active',
 activity text not null default'Just now',record_state text not null default'active' check(record_state in('active','review','completed','archived')),
 sort_order integer not null default 100,metadata jsonb not null default'{}',created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists ceo_module_records_org_module_idx on public.ceo_module_records(organization_id,module_key,sort_order,created_at);
alter table public.ceo_module_records enable row level security;
create policy "members read module records" on public.ceo_module_records for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_module_records.organization_id and m.user_id=(select auth.uid())and m.status='active'));
create policy "operators create module records" on public.ceo_module_records for insert to authenticated with check(created_by=(select auth.uid())and exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_module_records.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role in('architect','ceo','operator')));
create policy "operators update module records" on public.ceo_module_records for update to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_module_records.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role in('architect','ceo','operator')))with check(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=ceo_module_records.organization_id and m.user_id=(select auth.uid())and m.status='active'and m.role in('architect','ceo','operator')));
with seed(module_key,name,category,status_value,activity,record_state,sort_order)as(values
 ('AI Mastery','Prompt Architecture','Advanced','82%','In progress','active',10),('Agent Hub','THELMA','Operations lead','Online','31 tasks','active',10),
 ('Leads Pipeline','Riverside property group','Qualified','$84,000','Today','review',10),('Content Engine','Reunion launch campaign','In review','12 assets','Aug 15','review',10),
 ('Social Media','Instagram','Connected','18.4K','6.8%','active',10),('Trends','Florida land opportunities','High','92','Rising','active',10),
 ('Communications','Board briefing packet','Executive Office','Priority','Unread','review',10),('CRM','Avery Holdings','Property investor','Qualified','Today','active',10),
 ('Products','CEO Command Center','Software','Active','$12,400','active',10),('Finance','Operating revenue','Income','$54,230','+12.4%','active',10),
 ('System Audit','Authentication policy','Security','Passed','Today','completed',10),('Certificates','AI Governance','The Architect','Verified','2027','completed',10),
 ('Settings','Executive preferences','Workspace','Configured','Edit','active',10),('Team Overview','Executive Office','2 members','84% capacity','Healthy','active',10),
 ('Video Storyboard','The Matriarch’s Debt','12 scenes','Pre-production','72%','active',10),('Social Analytics','Total reach','All channels','184,220','+18%','active',10),
 ('Lead Scoring Rules','Budget fit','Financial','25 points','Active','active',10),('API Integration','Supabase','Data & Auth','Connected','Healthy','active',10),
 ('Revenue Report','Software & systems','Current month','$28,400','52%','active',10),('Agent Logs','THELMA daily orchestration','Completed','1m 42s','Today','completed',10),
 ('Media Library','Brand library','128 assets','Updated today','Shared','active',10),('Multi-Account Posting','Reunion campaign','4 channels','Scheduled','Aug 15','review',10),
 ('Trend Signal Alerts','Florida property velocity','Property','High','Active','active',10),('Help Center','Launch the CEO Dashboard','Getting started','5 min','Open','active',10))
insert into public.ceo_module_records(organization_id,module_key,name,category,status_value,activity,record_state,sort_order,created_by)
select o.id,s.module_key,s.name,s.category,s.status_value,s.activity,s.record_state,s.sort_order,o.created_by from public.ceo_organizations o cross join seed s
where o.slug='estiban-creations'and not exists(select 1 from public.ceo_module_records r where r.organization_id=o.id and r.module_key=s.module_key and r.name=s.name);
commit;

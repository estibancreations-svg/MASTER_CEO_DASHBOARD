-- Enterprise Recalibration: Base Ten runtime governance + Social-Commerce reporting foundation.
-- Authority: The Architect. Canonical policy lives in Master-System-Buildout.

begin;

create table if not exists public.architect_governance_policy (
  organization_id uuid primary key references public.ceo_organizations(id) on delete cascade,
  authority_owner text not null default 'THE_ARCHITECT',
  system_scope smallint not null default 100 check (system_scope = 100),
  reserved_authority smallint not null default 60 check (reserved_authority between 60 and 100),
  final_decision_owner text not null default 'THE_ARCHITECT',
  recommendations_allowed boolean not null default true,
  challenge_allowed boolean not null default true,
  silent_override_allowed boolean not null default false,
  emergency_bypass_owner text not null default 'THE_ARCHITECT',
  governance_version text not null default 'BASE_TEN_V1',
  state text not null default 'ACTIVE' check (state in ('ACTIVE','SUPERSEDED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.architect_governance_policy enable row level security;
drop policy if exists architect_governance_member_select on public.architect_governance_policy;
create policy architect_governance_member_select on public.architect_governance_policy
for select to authenticated using (public.is_active_org_member(organization_id));

drop trigger if exists touch_architect_governance_policy on public.architect_governance_policy;
create trigger touch_architect_governance_policy before update on public.architect_governance_policy
for each row execute function public.touch_updated_at();

insert into public.architect_governance_policy(organization_id)
select id from public.ceo_organizations where slug='estiban-creations'
on conflict (organization_id) do update set
  authority_owner='THE_ARCHITECT', system_scope=100, reserved_authority=60,
  final_decision_owner='THE_ARCHITECT', recommendations_allowed=true,
  challenge_allowed=true, silent_override_allowed=false,
  emergency_bypass_owner='THE_ARCHITECT', governance_version='BASE_TEN_V1',
  state='ACTIVE', updated_at=now();

create or replace function public.is_architect_for_org(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.ceo_organization_memberships m
    where m.organization_id=p_organization_id
      and m.user_id=auth.uid()
      and m.status='active'
      and m.role='architect'
  );
$$;
revoke all on function public.is_architect_for_org(uuid) from public;
grant execute on function public.is_architect_for_org(uuid) to authenticated;

alter table public.thelma_approval_requests
  add column if not exists architect_final_required boolean not null default false,
  add column if not exists governance_basis text not null default 'BASE_TEN_V1',
  add column if not exists authority_evidence jsonb not null default '{}'::jsonb;

update public.thelma_approval_requests
set architect_final_required=true,
    governance_basis='BASE_TEN_V1',
    authority_evidence=coalesce(authority_evidence,'{}'::jsonb)||jsonb_build_object('reason','high_or_critical_risk','reserved_authority',60)
where risk_tier in ('high','critical');

create or replace function public.decide_thelma_approval(p_request_id uuid, p_decision text, p_reason text default null)
returns public.thelma_approval_requests
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.thelma_approval_requests;
  member_role text;
begin
  if p_decision not in ('APPROVED','REJECTED') then raise exception 'invalid_decision'; end if;
  select * into r from public.thelma_approval_requests where id=p_request_id for update;
  if r.id is null then raise exception 'approval_not_found'; end if;

  select role into member_role
  from public.ceo_organization_memberships
  where organization_id=r.organization_id and user_id=auth.uid() and status='active';

  if member_role is null then raise exception 'membership_required'; end if;
  if r.status <> 'PENDING' then raise exception 'approval_not_pending'; end if;

  if r.architect_final_required and member_role <> 'architect' then
    raise exception 'architect_final_authority_required';
  end if;
  if member_role not in ('architect','delegated_approver') then
    raise exception 'approval_authority_required';
  end if;
  if member_role='delegated_approver' and r.risk_tier in ('high','critical') then
    raise exception 'architect_high_risk_authority_required';
  end if;

  update public.thelma_approval_requests
     set status=p_decision,
         decided_at=now(),
         decided_by=auth.uid(),
         decision_reason=p_reason,
         governance_basis='BASE_TEN_V1',
         authority_evidence=coalesce(authority_evidence,'{}'::jsonb)||jsonb_build_object(
           'decision_role',member_role,
           'architect_final_required',r.architect_final_required,
           'authority_owner','THE_ARCHITECT',
           'reserved_authority',60,
           'decision_at',now()
         ),
         updated_at=now()
   where id=p_request_id returning * into r;

  update public.thelma_alerts
     set state='ACKNOWLEDGED', updated_at=now()
   where approval_request_id=p_request_id;

  insert into public.agent_security_events(organization_id,agent_key,event_type,severity,decision,reason,evidence)
  values(
    r.organization_id,r.requested_by_agent,'BASE_TEN_APPROVAL_DECISION',r.risk_tier,p_decision,coalesce(p_reason,''),
    jsonb_build_object(
      'approval_request_id',r.id,'action_type',r.action_type,'tool_key',r.tool_key,
      'decision_role',member_role,'architect_final_required',r.architect_final_required,
      'authority_owner','THE_ARCHITECT','reserved_authority',60,'silent_override_allowed',false
    )
  );
  return r;
end $$;
revoke all on function public.decide_thelma_approval(uuid,text,text) from public;
grant execute on function public.decide_thelma_approval(uuid,text,text) to authenticated;

-- Social-Commerce operational ledger.
create table if not exists public.social_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  source_system_key text not null,
  platform text not null,
  account_key text not null,
  content_key text,
  campaign_key text,
  project_key text,
  client_key text,
  published_at timestamptz,
  period_start timestamptz not null,
  period_end timestamptz not null,
  views bigint not null default 0 check (views>=0),
  impressions bigint not null default 0 check (impressions>=0),
  reach bigint not null default 0 check (reach>=0),
  unique_viewers bigint check (unique_viewers is null or unique_viewers>=0),
  watch_time_seconds numeric(18,2) not null default 0 check (watch_time_seconds>=0),
  average_view_duration_seconds numeric(14,2),
  completion_rate numeric(7,4),
  engagements bigint not null default 0 check (engagements>=0),
  likes bigint not null default 0 check (likes>=0),
  comments bigint not null default 0 check (comments>=0),
  shares bigint not null default 0 check (shares>=0),
  saves bigint not null default 0 check (saves>=0),
  clicks bigint not null default 0 check (clicks>=0),
  followers_gained bigint not null default 0,
  followers_lost bigint not null default 0,
  leads bigint not null default 0 check (leads>=0),
  conversions bigint not null default 0 check (conversions>=0),
  attributable_orders bigint not null default 0 check (attributable_orders>=0),
  attributable_revenue numeric(16,2) not null default 0 check (attributable_revenue>=0),
  boost_spend numeric(16,2) not null default 0 check (boost_spend>=0),
  ad_spend numeric(16,2) not null default 0 check (ad_spend>=0),
  organic_paid text not null default 'UNKNOWN' check (organic_paid in ('ORGANIC','PAID','MIXED','UNKNOWN')),
  attribution_method text not null default 'unknown',
  attribution_confidence numeric(5,2) check (attribution_confidence is null or attribution_confidence between 0 and 100),
  source_provenance jsonb not null default '{}'::jsonb,
  retrieved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists social_metric_org_period_idx on public.social_metric_snapshots(organization_id,period_start,period_end);
create index if not exists social_metric_campaign_idx on public.social_metric_snapshots(organization_id,campaign_key,content_key);

create table if not exists public.social_attribution_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  occurred_at timestamptz not null,
  platform text,
  account_key text,
  campaign_key text,
  content_key text,
  project_key text,
  client_key text,
  event_type text not null,
  revenue_amount numeric(16,2) not null default 0,
  cost_amount numeric(16,2) not null default 0,
  attribution_method text not null check (attribution_method in ('direct','last_touch','first_touch','assisted','multi_touch','modeled','correlated','unknown')),
  confidence numeric(5,2) check (confidence is null or confidence between 0 and 100),
  conversion_window text,
  tracking_reference text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.social_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  views bigint not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  engagements bigint not null default 0,
  clicks bigint not null default 0,
  leads bigint not null default 0,
  conversions bigint not null default 0,
  attributable_revenue numeric(16,2) not null default 0,
  boost_spend numeric(16,2) not null default 0,
  ad_spend numeric(16,2) not null default 0,
  source_rows integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  unique(organization_id,week_start)
);

create table if not exists public.social_monthly_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  month_start date not null,
  month_end date not null,
  views bigint not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  engagements bigint not null default 0,
  clicks bigint not null default 0,
  leads bigint not null default 0,
  conversions bigint not null default 0,
  attributable_revenue numeric(16,2) not null default 0,
  boost_spend numeric(16,2) not null default 0,
  ad_spend numeric(16,2) not null default 0,
  source_rows integer not null default 0,
  locked boolean not null default true,
  summary jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  unique(organization_id,month_start)
);

create table if not exists public.social_forecasts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  system_key text not null default 'SYS-CMGIO-001',
  metric text not null,
  forecast_period_start date not null,
  forecast_period_end date not null,
  predicted_low numeric(20,4),
  predicted_mid numeric(20,4) not null,
  predicted_high numeric(20,4),
  confidence numeric(5,2) check (confidence is null or confidence between 0 and 100),
  actual_value numeric(20,4),
  absolute_error numeric(20,4),
  percent_error numeric(12,4),
  model_or_policy text,
  rationale text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  evaluated_at timestamptz
);

alter table public.social_metric_snapshots enable row level security;
alter table public.social_attribution_events enable row level security;
alter table public.social_weekly_reports enable row level security;
alter table public.social_monthly_reports enable row level security;
alter table public.social_forecasts enable row level security;

do $$
declare t text;
begin
  foreach t in array array['social_metric_snapshots','social_attribution_events','social_weekly_reports','social_monthly_reports','social_forecasts']
  loop
    execute format('drop policy if exists %I on public.%I',t||'_member_select',t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_active_org_member(organization_id))',t||'_member_select',t);
  end loop;
end $$;

create or replace function public.refresh_social_weekly_report(p_organization_id uuid, p_week_start date default date_trunc('week',current_date)::date)
returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid; wend date:=p_week_start+6;
begin
  insert into public.social_weekly_reports(
    organization_id,week_start,week_end,views,impressions,reach,engagements,clicks,leads,conversions,
    attributable_revenue,boost_spend,ad_spend,source_rows,summary,generated_at
  )
  select p_organization_id,p_week_start,wend,
    coalesce(sum(views),0),coalesce(sum(impressions),0),coalesce(sum(reach),0),coalesce(sum(engagements),0),
    coalesce(sum(clicks),0),coalesce(sum(leads),0),coalesce(sum(conversions),0),
    coalesce(sum(attributable_revenue),0),coalesce(sum(boost_spend),0),coalesce(sum(ad_spend),0),count(*)::int,
    jsonb_build_object(
      'net_followers',coalesce(sum(followers_gained-followers_lost),0),
      'watch_time_seconds',coalesce(sum(watch_time_seconds),0),
      'attribution_rule','Report attributable revenue only where source evidence supplies an attribution method; correlation must remain labeled correlated.'
    ),now()
  from public.social_metric_snapshots
  where organization_id=p_organization_id
    and period_start < (wend+1)::timestamptz
    and period_end >= p_week_start::timestamptz
  on conflict(organization_id,week_start) do update set
    week_end=excluded.week_end,views=excluded.views,impressions=excluded.impressions,reach=excluded.reach,
    engagements=excluded.engagements,clicks=excluded.clicks,leads=excluded.leads,conversions=excluded.conversions,
    attributable_revenue=excluded.attributable_revenue,boost_spend=excluded.boost_spend,ad_spend=excluded.ad_spend,
    source_rows=excluded.source_rows,summary=excluded.summary,generated_at=now()
  returning id into rid;
  return rid;
end $$;

create or replace function public.refresh_social_monthly_report(p_organization_id uuid, p_month_start date default date_trunc('month',current_date)::date)
returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid; mend date:=(p_month_start+interval '1 month-1 day')::date;
begin
  insert into public.social_monthly_reports(
    organization_id,month_start,month_end,views,impressions,reach,engagements,clicks,leads,conversions,
    attributable_revenue,boost_spend,ad_spend,source_rows,locked,summary,generated_at
  )
  select p_organization_id,p_month_start,mend,
    coalesce(sum(views),0),coalesce(sum(impressions),0),coalesce(sum(reach),0),coalesce(sum(engagements),0),
    coalesce(sum(clicks),0),coalesce(sum(leads),0),coalesce(sum(conversions),0),
    coalesce(sum(attributable_revenue),0),coalesce(sum(boost_spend),0),coalesce(sum(ad_spend),0),count(*)::int,true,
    jsonb_build_object(
      'net_followers',coalesce(sum(followers_gained-followers_lost),0),
      'watch_time_seconds',coalesce(sum(watch_time_seconds),0),
      'snapshot_policy','Locked monthly historical snapshot; corrections require a new governed evidence trail.'
    ),now()
  from public.social_metric_snapshots
  where organization_id=p_organization_id
    and period_start < (mend+1)::timestamptz
    and period_end >= p_month_start::timestamptz
  on conflict(organization_id,month_start) do update set
    month_end=excluded.month_end,views=excluded.views,impressions=excluded.impressions,reach=excluded.reach,
    engagements=excluded.engagements,clicks=excluded.clicks,leads=excluded.leads,conversions=excluded.conversions,
    attributable_revenue=excluded.attributable_revenue,boost_spend=excluded.boost_spend,ad_spend=excluded.ad_spend,
    source_rows=excluded.source_rows,summary=excluded.summary,generated_at=now()
  returning id into rid;
  return rid;
end $$;

create or replace function public.refresh_all_social_weekly_reports()
returns integer language plpgsql security definer set search_path=public as $$
declare r record; n integer:=0;
begin
  for r in select id from public.ceo_organizations loop
    perform public.refresh_social_weekly_report(r.id,date_trunc('week',current_date)::date);
    n:=n+1;
  end loop;
  return n;
end $$;

create or replace function public.refresh_previous_social_monthly_reports()
returns integer language plpgsql security definer set search_path=public as $$
declare r record; n integer:=0; m date:=date_trunc('month',current_date-interval '1 month')::date;
begin
  for r in select id from public.ceo_organizations loop
    perform public.refresh_social_monthly_report(r.id,m);
    n:=n+1;
  end loop;
  return n;
end $$;

-- Same Monday/Thursday intelligence days, after the Ecosystem partitions.
select cron.unschedule(jobid) from cron.job where jobname='social-commerce-weekly-intelligence-refresh';
select cron.schedule('social-commerce-weekly-intelligence-refresh','10 13 * * 1,4',$$select public.refresh_all_social_weekly_reports();$$);
select cron.unschedule(jobid) from cron.job where jobname='social-commerce-monthly-close';
select cron.schedule('social-commerce-monthly-close','20 13 1 * *',$$select public.refresh_previous_social_monthly_reports();$$);

commit;

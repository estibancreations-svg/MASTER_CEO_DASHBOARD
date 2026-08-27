create table if not exists public.resource_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  provider_key text not null,
  account_key text not null,
  display_name text not null,
  resource_class text not null check(resource_class in ('FREE_API','FREE_WEB','INCLUDED_SUBSCRIPTION','PROMOTIONAL_CREDIT','PREPAID_CREDIT','PAYG','OPEN_LOCAL','INTERACTIVE_ONLY','UNKNOWN')),
  unit text not null default 'usd',
  starting_quantity numeric,
  current_quantity numeric,
  unit_usd numeric,
  currency text not null default 'USD',
  balance_method text not null default 'MANUAL' check(balance_method in ('LIVE_API','USAGE_DERIVED','MANUAL','BUDGET_DERIVED','UNBOUNDED')),
  balance_confidence text not null default 'UNKNOWN' check(balance_confidence in ('HIGH','MEDIUM','LOW','UNKNOWN')),
  is_automatable boolean not null default false,
  commercial_use_state text not null default 'UNKNOWN' check(commercial_use_state in ('APPROVED','CONDITIONAL','PROTOTYPE_ONLY','BLOCKED','UNKNOWN')),
  privacy_state text not null default 'UNKNOWN' check(privacy_state in ('APPROVED','CONDITIONAL','BLOCKED','UNKNOWN')),
  preferred_rank integer not null default 100,
  source_url text,
  expires_at timestamptz,
  last_synced_at timestamptz,
  last_verified_at timestamptz,
  status text not null default 'STAGED' check(status in ('ACTIVE','STAGED','NEEDS_SYNC','DEPLETED','EXPIRED','BLOCKED','DISABLED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,provider_key,account_key)
);

create table if not exists public.resource_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  resource_account_id uuid not null references public.resource_accounts(id) on delete cascade,
  captured_at timestamptz not null default now(),
  quantity_remaining numeric,
  estimated_value_usd numeric,
  source_type text not null check(source_type in ('LIVE_API','USAGE_DERIVED','MANUAL','BUDGET_DERIVED','SYSTEM_STARTUP')),
  confidence text not null default 'UNKNOWN' check(confidence in ('HIGH','MEDIUM','LOW','UNKNOWN')),
  source_reference text,
  evidence jsonb not null default '{}'::jsonb
);
create index if not exists resource_balance_snapshots_account_time_idx on public.resource_balance_snapshots(resource_account_id,captured_at desc);

create table if not exists public.resource_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  occurred_at timestamptz not null default now(),
  system_key text not null,
  project_key text,
  job_key text,
  user_id uuid,
  resource_account_id uuid references public.resource_accounts(id) on delete set null,
  provider_key text not null,
  model_id text,
  task_class text,
  modality text,
  quantity numeric,
  unit text,
  input_tokens bigint,
  output_tokens bigint,
  provider_credits numeric,
  cost_usd numeric not null default 0,
  avoided_cost_usd numeric not null default 0,
  chargeback_amount_usd numeric,
  billable_party text,
  billing_status text not null default 'UNREVIEWED' check(billing_status in ('UNREVIEWED','INTERNAL','CLIENT_BILLABLE','INVOICED','NON_BILLABLE','CREDITED')),
  source_type text not null default 'SYSTEM' check(source_type in ('SYSTEM','PROVIDER_API','MANUAL_IMPORT','ESTIMATE')),
  source_event_ref text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists resource_usage_events_source_ref_uq on public.resource_usage_events(organization_id,provider_key,source_event_ref) where source_event_ref is not null;
create index if not exists resource_usage_events_system_time_idx on public.resource_usage_events(organization_id,system_key,occurred_at desc);

create table if not exists public.system_resource_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  system_key text not null,
  free_included_first boolean not null default true,
  manual_override_allowed boolean not null default true,
  runway_preferred boolean not null default false,
  openai_project_preferred boolean not null default false,
  commercial_use_required boolean not null default true,
  minimum_quality_score numeric not null default 80,
  max_job_cost_usd numeric,
  monthly_budget_usd numeric,
  preferred_provider_order jsonb not null default '[]'::jsonb,
  preferred_models jsonb not null default '[]'::jsonb,
  blocked_providers jsonb not null default '[]'::jsonb,
  data_classification_floor text not null default 'INTERNAL',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,system_key)
);

create table if not exists public.resource_model_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  system_key text not null,
  project_key text,
  task_class text,
  provider_key text not null,
  model_id text,
  reason text,
  requested_by uuid,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  state text not null default 'ACTIVE' check(state in ('ACTIVE','EXPIRED','CANCELLED')),
  created_at timestamptz not null default now()
);
create index if not exists resource_model_overrides_lookup_idx on public.resource_model_overrides(organization_id,system_key,project_key,task_class,state,starts_at desc);

create table if not exists public.model_benchmark_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  system_key text,
  project_key text,
  provider_key text not null,
  model_id text not null,
  task_class text not null,
  benchmark_set text,
  quality_score numeric,
  verifier_score numeric,
  latency_ms integer,
  cost_usd numeric,
  accepted boolean,
  retry_count integer not null default 0,
  rights_cleared boolean,
  notes text,
  evidence jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now()
);
create index if not exists model_benchmark_results_model_task_idx on public.model_benchmark_results(organization_id,task_class,provider_key,model_id,observed_at desc);

create table if not exists public.model_intelligence_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  system_key text,
  task_class text not null,
  provider_key text not null,
  model_id text not null,
  recommendation_rank integer not null default 1,
  recommendation_state text not null default 'ACTIVE' check(recommendation_state in ('ACTIVE','CANDIDATE','SUPERSEDED','REJECTED')),
  quality_score numeric,
  cost_score numeric,
  reliability_score numeric,
  rights_state text,
  rationale text not null,
  source_run_id uuid,
  evidence jsonb not null default '{}'::jsonb,
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.resource_daily_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  report_date date not null,
  system_key text not null,
  system_name text not null,
  available_resources jsonb not null default '[]'::jsonb,
  preferred_route jsonb not null default '{}'::jsonb,
  opening_estimated_value_usd numeric,
  spend_today_usd numeric not null default 0,
  avoided_cost_today_usd numeric not null default 0,
  usage_event_count integer not null default 0,
  stale_resource_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  unique(organization_id,report_date,system_key)
);

alter table public.model_pricing_history add column if not exists price_component text;
alter table public.model_pricing_history add column if not exists unit text;
alter table public.model_pricing_history add column if not exists currency text not null default 'USD';
alter table public.model_pricing_history add column if not exists effective_at timestamptz;
alter table public.model_pricing_history add column if not exists source_url text;
alter table public.model_pricing_history add column if not exists verified_at timestamptz;

create or replace function public.record_resource_usage(
  p_organization_id uuid,p_system_key text,p_provider_key text,p_model_id text default null,p_task_class text default null,
  p_project_key text default null,p_job_key text default null,p_user_id uuid default null,p_quantity numeric default null,p_unit text default null,
  p_input_tokens bigint default null,p_output_tokens bigint default null,p_provider_credits numeric default null,p_cost_usd numeric default 0,
  p_avoided_cost_usd numeric default 0,p_source_type text default 'SYSTEM',p_source_event_ref text default null,p_evidence jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_account uuid;
begin
  select id into v_account from public.resource_accounts
   where organization_id=p_organization_id and provider_key=p_provider_key and status in ('ACTIVE','STAGED','NEEDS_SYNC')
   order by preferred_rank,updated_at desc limit 1;
  insert into public.resource_usage_events(
    organization_id,system_key,project_key,job_key,user_id,resource_account_id,provider_key,model_id,task_class,quantity,unit,
    input_tokens,output_tokens,provider_credits,cost_usd,avoided_cost_usd,source_type,source_event_ref,evidence
  ) values(
    p_organization_id,p_system_key,p_project_key,p_job_key,p_user_id,v_account,p_provider_key,p_model_id,p_task_class,p_quantity,p_unit,
    p_input_tokens,p_output_tokens,p_provider_credits,coalesce(p_cost_usd,0),coalesce(p_avoided_cost_usd,0),p_source_type,p_source_event_ref,coalesce(p_evidence,'{}'::jsonb)
  ) on conflict (organization_id,provider_key,source_event_ref) where source_event_ref is not null
  do update set evidence=public.resource_usage_events.evidence||excluded.evidence returning id into v_id;
  return v_id;
end $$;

create or replace function public.refresh_resource_daily_reports(p_organization_id uuid,p_report_date date default current_date)
returns integer language plpgsql security definer set search_path=public as $$
declare s record; v_count int:=0; v_resources jsonb; v_spend numeric; v_avoided numeric; v_usage int; v_stale int; v_warnings jsonb; v_policy jsonb; v_value numeric;
begin
  for s in select system_key,display_name from public.analyst_system_index where organization_id=p_organization_id order by system_key loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'provider',provider_key,'account',account_key,'name',display_name,'class',resource_class,'unit',unit,'quantity',current_quantity,
      'unit_usd',unit_usd,'estimated_value_usd',case when current_quantity is not null and unit_usd is not null then current_quantity*unit_usd else null end,
      'status',status,'confidence',balance_confidence,'last_synced_at',last_synced_at,'expires_at',expires_at,'automatable',is_automatable,
      'commercial_use',commercial_use_state,'privacy',privacy_state,'rank',preferred_rank
    ) order by preferred_rank,provider_key),'[]'::jsonb),
    coalesce(sum(case when status in ('ACTIVE','STAGED','NEEDS_SYNC') and current_quantity is not null and unit_usd is not null then current_quantity*unit_usd else 0 end),0),
    count(*) filter(where status in ('NEEDS_SYNC','STAGED') or last_synced_at is null or last_synced_at<now()-interval '36 hours')
    into v_resources,v_value,v_stale from public.resource_accounts
    where organization_id=p_organization_id and status not in ('DISABLED','EXPIRED');

    select coalesce(sum(cost_usd),0),coalesce(sum(avoided_cost_usd),0),count(*) into v_spend,v_avoided,v_usage
      from public.resource_usage_events where organization_id=p_organization_id and system_key=s.system_key
      and occurred_at>=p_report_date::timestamptz and occurred_at<(p_report_date+1)::timestamptz;

    select to_jsonb(p) into v_policy from public.system_resource_policies p where p.organization_id=p_organization_id and p.system_key=s.system_key;
    v_warnings='[]'::jsonb;
    if v_stale>0 then v_warnings=v_warnings||jsonb_build_array(jsonb_build_object('type','STALE_BALANCE','count',v_stale,'message','One or more resource balances/entitlements need synchronization.')); end if;
    if exists(select 1 from public.resource_accounts where organization_id=p_organization_id and expires_at is not null and expires_at<now()+interval '14 days' and status in ('ACTIVE','STAGED','NEEDS_SYNC')) then
      v_warnings=v_warnings||jsonb_build_array(jsonb_build_object('type','EXPIRING_RESOURCE','message','One or more credits/entitlements expire within 14 days.'));
    end if;
    insert into public.resource_daily_reports(
      organization_id,report_date,system_key,system_name,available_resources,preferred_route,opening_estimated_value_usd,
      spend_today_usd,avoided_cost_today_usd,usage_event_count,stale_resource_count,warnings,generated_at
    ) values(
      p_organization_id,p_report_date,s.system_key,s.display_name,v_resources,coalesce(v_policy,'{}'::jsonb),v_value,
      v_spend,v_avoided,v_usage,v_stale,v_warnings,now()
    ) on conflict(organization_id,report_date,system_key) do update set
      system_name=excluded.system_name,available_resources=excluded.available_resources,preferred_route=excluded.preferred_route,
      opening_estimated_value_usd=excluded.opening_estimated_value_usd,spend_today_usd=excluded.spend_today_usd,
      avoided_cost_today_usd=excluded.avoided_cost_today_usd,usage_event_count=excluded.usage_event_count,
      stale_resource_count=excluded.stale_resource_count,warnings=excluded.warnings,generated_at=now();
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

create or replace view public.resource_billing_monthly with (security_invoker=true) as
select organization_id,date_trunc('month',occurred_at)::date billing_month,system_key,project_key,provider_key,model_id,task_class,
count(*) usage_events,sum(coalesce(provider_credits,0)) provider_credits,sum(coalesce(cost_usd,0)) cost_usd,
sum(coalesce(avoided_cost_usd,0)) avoided_cost_usd,sum(coalesce(chargeback_amount_usd,0)) chargeback_amount_usd,
count(*) filter(where billing_status='CLIENT_BILLABLE') client_billable_events,count(*) filter(where billing_status='INVOICED') invoiced_events
from public.resource_usage_events group by organization_id,date_trunc('month',occurred_at)::date,system_key,project_key,provider_key,model_id,task_class;

create or replace view public.model_task_scorecard with (security_invoker=true) as
select organization_id,task_class,provider_key,model_id,count(*) sample_count,round(avg(quality_score),2) avg_quality,
round(avg(verifier_score),2) avg_verifier,round(avg(latency_ms),0) avg_latency_ms,round(avg(cost_usd),4) avg_cost_usd,
round(100.0*avg(case when accepted then 1 else 0 end),1) acceptance_rate_pct,max(observed_at) last_observed_at
from public.model_benchmark_results group by organization_id,task_class,provider_key,model_id;

alter table public.resource_accounts enable row level security;
alter table public.resource_balance_snapshots enable row level security;
alter table public.resource_usage_events enable row level security;
alter table public.system_resource_policies enable row level security;
alter table public.resource_model_overrides enable row level security;
alter table public.model_benchmark_results enable row level security;
alter table public.model_intelligence_recommendations enable row level security;
alter table public.resource_daily_reports enable row level security;

do $$ declare t text; begin
  foreach t in array array['resource_accounts','resource_balance_snapshots','resource_usage_events','system_resource_policies','resource_model_overrides','model_benchmark_results','model_intelligence_recommendations','resource_daily_reports'] loop
    execute format('create policy %I on public.%I for select using (public.is_active_org_member(organization_id))',t||'_org_read',t);
  end loop;
end $$;
create policy resource_model_overrides_org_write on public.resource_model_overrides for insert with check(public.is_active_org_member(organization_id));
create policy resource_model_overrides_org_update on public.resource_model_overrides for update using(public.is_active_org_member(organization_id)) with check(public.is_active_org_member(organization_id));

create table if not exists public.intelligence_research_runs(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trigger_type text not null,
  status text not null default 'RUNNING',
  research_model_provider text,
  research_model_id text,
  input_tokens bigint,
  output_tokens bigint,
  estimated_cost_usd numeric not null default 0,
  findings_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_summary text,
  evidence jsonb not null default '{}'::jsonb
);

create table if not exists public.intelligence_research_findings(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  run_id uuid not null references public.intelligence_research_runs(id) on delete cascade,
  finding_key text not null,
  category text not null check(category in ('MODEL','TOOL','PLUGIN','PROVIDER','PRICING','FREE_TIER','CREDITS','LICENSING','DEPRECATION','API_CHANGE','SECURITY','OTHER')),
  provider_key text,
  product_name text,
  model_id text,
  system_keys jsonb not null default '[]'::jsonb,
  task_classes jsonb not null default '[]'::jsonb,
  title text not null,
  summary text not null,
  why_it_matters text,
  recommendation text,
  recommendation_state text not null default 'REVIEW' check(recommendation_state in ('ADOPT','ADAPT','EVALUATE','REFERENCE','WATCH','REJECT','REVIEW')),
  commercial_fit text,
  free_or_included_state text,
  source_urls jsonb not null default '[]'::jsonb,
  source_dates jsonb not null default '[]'::jsonb,
  confidence numeric,
  evidence jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  unique(organization_id,finding_key)
);
create index if not exists intelligence_research_findings_org_time_idx on public.intelligence_research_findings(organization_id,observed_at desc);
create index if not exists intelligence_research_findings_provider_idx on public.intelligence_research_findings(organization_id,provider_key,category);

alter table public.intelligence_research_runs enable row level security;
alter table public.intelligence_research_findings enable row level security;
create policy intelligence_research_runs_org_read on public.intelligence_research_runs for select using(public.is_active_org_member(organization_id));
create policy intelligence_research_findings_org_read on public.intelligence_research_findings for select using(public.is_active_org_member(organization_id));

create or replace view public.model_intelligence_weekly_digest with (security_invoker=true) as
select f.organization_id,f.provider_key,f.product_name,f.model_id,f.category,f.title,f.summary,f.why_it_matters,f.recommendation,
       f.recommendation_state,f.commercial_fit,f.free_or_included_state,f.source_urls,f.confidence,f.observed_at
from public.intelligence_research_findings f
where f.observed_at>=now()-interval '14 days'
order by f.observed_at desc,f.confidence desc nulls last;

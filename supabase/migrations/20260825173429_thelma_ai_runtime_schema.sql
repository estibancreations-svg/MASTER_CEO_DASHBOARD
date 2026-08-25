-- Applied live to Supabase project yqealeekngxooyoemfba as 20260825173429_thelma_ai_runtime_schema.
-- THELMA conversational runtime, specialist profiles, White Blood Cell signals, repair plans and tool-event evidence.
create table if not exists public.thelma_agent_profiles (
  organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  agent_key text not null,
  parent_agent_key text,
  agent_class text not null check (agent_class in ('ORCHESTRATOR','SPECIALIST','REPAIR_CELL','EVALUATOR')),
  mission text not null,
  specialties text[] not null default '{}',
  default_model_route text not null default 'automatic',
  repair_capabilities text[] not null default '{}',
  autonomy_mode text not null default 'ADVISE' check (autonomy_mode in ('ADVISE','LOW_RISK_AUTONOMY','APPROVAL_REQUIRED','DISABLED')),
  operational_state text not null default 'STANDBY' check (operational_state in ('ACTIVE','STANDBY','DEGRADED','DISABLED')),
  memory_scopes text[] not null default '{}',
  tool_scopes text[] not null default '{}',
  system_prompt_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, agent_key),
  foreign key (organization_id, agent_key) references public.orchestration_agents(organization_id, agent_key) on delete cascade
);
create table if not exists public.thelma_conversations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade, title text not null default 'THELMA conversation', context_system_key text,
  status text not null default 'active' check (status in ('active','archived')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.thelma_messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.thelma_conversations(id) on delete cascade,
  organization_id uuid not null references public.ceo_organizations(id) on delete cascade, role text not null check (role in ('user','assistant','system','tool')),
  agent_key text, content text not null, citations jsonb not null default '[]'::jsonb, tool_events jsonb not null default '[]'::jsonb,
  model_provider text, model_id text, input_tokens integer, output_tokens integer, usage_cost numeric(12,6), created_at timestamptz not null default now()
);
create table if not exists public.white_blood_cell_signals (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  fingerprint text not null, source_type text not null, source_ref text, system_key text not null,
  severity text not null check (severity in ('critical','high','medium','low','info')), signal_type text not null, title text not null, summary text not null,
  state text not null default 'OPEN' check (state in ('OPEN','DIAGNOSING','REPAIR_PROPOSED','AUTHORIZED','REPAIRING','VERIFYING','RESOLVED','BLOCKED','SUPPRESSED')),
  owner_agent text, recommended_agent text, repair_scope text not null default 'PROPOSE_ONLY' check (repair_scope in ('OBSERVE','PROPOSE_ONLY','LOW_RISK_AUTO','APPROVAL_REQUIRED')),
  evidence jsonb not null default '{}'::jsonb, first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(), resolved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id, fingerprint)
);
create table if not exists public.thelma_repair_plans (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  signal_id uuid references public.white_blood_cell_signals(id) on delete set null, plan_key text not null, proposed_by text not null,
  risk_tier text not null check (risk_tier in ('LOW','MEDIUM','HIGH','CRITICAL')), problem_statement text not null, root_cause text,
  steps jsonb not null default '[]'::jsonb, verification_plan jsonb not null default '[]'::jsonb, required_capabilities text[] not null default '{}',
  human_approval_required boolean not null default true, status text not null default 'PROPOSED' check (status in ('PROPOSED','APPROVED','EXECUTING','VERIFYING','VERIFIED','FAILED','REJECTED','BLOCKED')),
  fabric_job_id uuid references public.ec_integration_jobs(id) on delete set null, evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id, plan_key)
);
create table if not exists public.thelma_tool_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  conversation_id uuid references public.thelma_conversations(id) on delete set null, message_id uuid references public.thelma_messages(id) on delete set null,
  run_id uuid references public.orchestration_runs(id) on delete set null, agent_key text not null, tool_key text not null, action text not null,
  status text not null check (status in ('STARTED','SUCCEEDED','FAILED','BLOCKED','PROPOSED')), request_summary text, response_summary text,
  evidence jsonb not null default '{}'::jsonb, duration_ms integer, usage_cost numeric(12,6), created_at timestamptz not null default now()
);
create index if not exists idx_thelma_messages_conversation_created on public.thelma_messages(conversation_id, created_at);
create index if not exists idx_wbc_state_severity on public.white_blood_cell_signals(organization_id, state, severity, last_seen_at desc);
create index if not exists idx_repair_plans_status on public.thelma_repair_plans(organization_id, status, updated_at desc);
create index if not exists idx_tool_events_agent_created on public.thelma_tool_events(organization_id, agent_key, created_at desc);
alter table public.thelma_agent_profiles enable row level security;
alter table public.thelma_conversations enable row level security;
alter table public.thelma_messages enable row level security;
alter table public.white_blood_cell_signals enable row level security;
alter table public.thelma_repair_plans enable row level security;
alter table public.thelma_tool_events enable row level security;
create or replace function public.is_active_org_member(p_org uuid) returns boolean language sql stable security definer set search_path=public,auth as $$
  select exists(select 1 from public.ceo_organization_memberships m where m.organization_id=p_org and m.user_id=auth.uid() and m.status='active')
$$;
revoke all on function public.is_active_org_member(uuid) from public;
grant execute on function public.is_active_org_member(uuid) to authenticated, service_role;
drop policy if exists thelma_profiles_read on public.thelma_agent_profiles;
create policy thelma_profiles_read on public.thelma_agent_profiles for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists thelma_conversations_owner on public.thelma_conversations;
create policy thelma_conversations_owner on public.thelma_conversations for all to authenticated using (created_by=auth.uid() and public.is_active_org_member(organization_id)) with check (created_by=auth.uid() and public.is_active_org_member(organization_id));
drop policy if exists thelma_messages_member_read on public.thelma_messages;
create policy thelma_messages_member_read on public.thelma_messages for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists thelma_messages_member_insert on public.thelma_messages;
create policy thelma_messages_member_insert on public.thelma_messages for insert to authenticated with check (public.is_active_org_member(organization_id) and exists(select 1 from public.thelma_conversations c where c.id=conversation_id and c.created_by=auth.uid()));
drop policy if exists wbc_member_read on public.white_blood_cell_signals;
create policy wbc_member_read on public.white_blood_cell_signals for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists repair_plans_member_read on public.thelma_repair_plans;
create policy repair_plans_member_read on public.thelma_repair_plans for select to authenticated using (public.is_active_org_member(organization_id));
drop policy if exists tool_events_member_read on public.thelma_tool_events;
create policy tool_events_member_read on public.thelma_tool_events for select to authenticated using (public.is_active_org_member(organization_id));

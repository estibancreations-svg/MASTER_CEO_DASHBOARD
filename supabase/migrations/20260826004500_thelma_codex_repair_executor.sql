-- Governed THELMA -> Codex -> GitHub repair execution ledger.
-- No request may execute until a human approval exists and the GitHub workflow
-- validates its request id, approval reference, allowed paths, tests, and PR gate.

create table if not exists public.thelma_code_repair_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  request_key text not null,
  finding_id uuid references public.analyst_findings(id) on delete set null,
  source_plan_id uuid references public.thelma_repair_plans(id) on delete set null,
  approval_request_id uuid not null references public.thelma_approval_requests(id) on delete restrict,
  title text not null,
  problem_statement text not null,
  desired_outcome text,
  constraints jsonb not null default '{}'::jsonb,
  allowed_paths text[] not null default array['src/','tests/','docs/'],
  forbidden_paths text[] not null default array['.github/workflows/','supabase/','.env','.env.local'],
  risk_tier text not null check (risk_tier in ('low','medium','high','critical')),
  status text not null default 'AWAITING_APPROVAL' check (status in (
    'AWAITING_APPROVAL','APPROVED','QUEUED','RUNNING','PATCH_PREPARED','TEST_FAILED',
    'PR_OPEN','QUALITY_GATE_FAILED','QUALITY_GATE_PASSED','MERGED','DEPLOYED','VERIFIED',
    'REJECTED','CANCELLED','FAILED','BLOCKED'
  )),
  executor_key text not null default 'CODEX_GITHUB_ACTION',
  model_route text not null default 'gpt-5.6-sol',
  sandbox_mode text not null default 'workspace-write' check (sandbox_mode in ('read-only','workspace-write')),
  quality_command text not null default 'npm run quality',
  branch_name text,
  base_sha text,
  head_sha text,
  pull_request_number integer,
  pull_request_url text,
  workflow_run_id bigint,
  execution_summary text,
  execution_evidence jsonb not null default '{}'::jsonb,
  verification_evidence jsonb not null default '{}'::jsonb,
  estimated_cost_cents integer not null default 0 check (estimated_cost_cents between 0 and 2500),
  actual_cost_cents integer check (actual_cost_cents between 0 and 2500),
  requested_by text not null default 'THELMA',
  approved_by uuid,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,request_key),
  unique(approval_request_id)
);

create index if not exists thelma_code_repair_status_idx
  on public.thelma_code_repair_requests(organization_id,status,created_at desc);
create index if not exists thelma_code_repair_finding_idx
  on public.thelma_code_repair_requests(finding_id) where finding_id is not null;

alter table public.thelma_code_repair_requests enable row level security;
drop policy if exists thelma_code_repair_member_select on public.thelma_code_repair_requests;
create policy thelma_code_repair_member_select
  on public.thelma_code_repair_requests for select to authenticated
  using (public.is_active_org_member(organization_id));

revoke all on table public.thelma_code_repair_requests from anon,authenticated;
grant select on table public.thelma_code_repair_requests to authenticated;
grant select,insert,update,delete on table public.thelma_code_repair_requests to service_role;

drop trigger if exists touch_thelma_code_repair_requests on public.thelma_code_repair_requests;
create trigger touch_thelma_code_repair_requests before update on public.thelma_code_repair_requests
for each row execute function public.touch_updated_at();

create or replace function public.sync_thelma_code_repair_approval()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_request_id uuid;
  v_finding_id uuid;
begin
  if new.action_type <> 'REPAIR_EXECUTION' then return new; end if;

  begin
    v_finding_id := nullif(new.proposed_payload->>'finding_id','')::uuid;
  exception when invalid_text_representation then
    v_finding_id := null;
  end;

  if new.status = 'APPROVED' and (old.status is distinct from new.status) then
    insert into public.thelma_code_repair_requests(
      organization_id,request_key,finding_id,source_plan_id,approval_request_id,title,
      problem_statement,desired_outcome,constraints,allowed_paths,forbidden_paths,
      risk_tier,status,approved_by,approved_at,requested_by
    ) values (
      new.organization_id,
      'REPAIR-'||new.id::text,
      v_finding_id,
      new.source_plan_id,
      new.id,
      new.title,
      new.description,
      new.proposed_payload->>'desired_outcome',
      new.proposed_payload,
      case
        when jsonb_typeof(new.proposed_payload->'allowed_paths')='array'
         and jsonb_array_length(new.proposed_payload->'allowed_paths')>0
        then array(select jsonb_array_elements_text(new.proposed_payload->'allowed_paths'))
        else array['src/','tests/','docs/']
      end,
      array['.github/workflows/','supabase/','.env','.env.local'],
      new.risk_tier,
      'APPROVED',
      new.decided_by,
      new.decided_at,
      new.requested_by_agent
    )
    on conflict (approval_request_id) do update set
      status='APPROVED',approved_by=excluded.approved_by,approved_at=excluded.approved_at,
      constraints=excluded.constraints,updated_at=now()
    returning id into v_request_id;

    insert into public.thelma_alerts(
      organization_id,source_type,source_ref,system_key,severity,title,summary,
      recommended_action,approval_required,state,evidence
    ) values (
      new.organization_id,'CODE_REPAIR',v_request_id::text,'SYS-THELMA-001',new.risk_tier,
      'Approved repair ready for Codex executor',new.title,
      'Dispatch only through the governed GitHub workflow. Review the resulting PR and Quality Gate before merge.',
      false,'NEW',jsonb_build_object('repair_request_id',v_request_id,'approval_request_id',new.id)
    ) on conflict (organization_id,source_type,source_ref) do update set
      summary=excluded.summary,state='NEW',evidence=excluded.evidence,updated_at=now();
  elsif new.status = 'REJECTED' and (old.status is distinct from new.status) then
    update public.thelma_code_repair_requests
       set status='REJECTED',completed_at=now(),updated_at=now()
     where approval_request_id=new.id;
  end if;
  return new;
end $$;
revoke all on function public.sync_thelma_code_repair_approval() from public,anon,authenticated;

drop trigger if exists sync_thelma_code_repair_approval on public.thelma_approval_requests;
create trigger sync_thelma_code_repair_approval
after update of status on public.thelma_approval_requests
for each row execute function public.sync_thelma_code_repair_approval();

update public.thelma_plugin_registry
set connection_state='AWAITING_CREDENTIAL',
    credential_ref_name='OPENAI_API_KEY',
    allowed_operations=array['inspect approved paths','prepare bounded patch','run tests','open repair pull request'],
    prohibited_operations=array['direct main write','self approval','merge without Quality Gate','credential access','workflow modification'],
    notes='Control plane and GitHub Action are installed. Activation waits for the dedicated OPENAI_API_KEY GitHub Actions secret; GitHub writes use the job-scoped token only after Codex exits.',
    metadata=metadata||jsonb_build_object('executor','openai/codex-action@v1','sandbox','workspace-write','quality_gate','npm run quality','activation_gate','GITHUB_ACTIONS_SECRET'),
    updated_at=now()
where plugin_key='codex-specialist';

update public.thelma_plugin_registry
set connection_state='PLANNED',
    allowed_operations=array['create repair branch','open pull request','read checks'],
    prohibited_operations=array['direct main write','bypass approval','bypass Quality Gate','broad personal token'],
    notes='GitHub workflow uses the repository job token for a single approved run. Runtime dispatch from Supabase remains disabled until a scoped workload-identity bridge is installed.',
    metadata=metadata||jsonb_build_object('credential_type','job_scoped_github_token','runtime_dispatch','not_active'),
    updated_at=now()
where plugin_key='github';

insert into public.analyst_findings(
  organization_id,finding_key,system_key,domain,title,description,finding_type,severity,status,priority,
  current_state,desired_state,remediation_plan,owner,blocking_dependency,source_ref,metadata
)
select id,'THELMA-CODEX-GITHUB-SECRET-INSTALL','SYS-THELMA-001','Agent Runtime',
       'Install dedicated OpenAI key in GitHub Actions',
       'The governed Codex repair workflow is installed but GitHub Actions cannot use the newly created key until it is stored as the repository secret OPENAI_API_KEY.',
       'CREDENTIAL_GATE','high','BLOCKED',96,
       'Dedicated key created securely and stored locally; connector lacks repository-secret administration permission.',
       'OPENAI_API_KEY exists as an encrypted GitHub Actions secret and a dry-run repair PR passes Quality Gate.',
       'Repository owner stores the dedicated key as OPENAI_API_KEY, then run one approved low-risk dry-run repair.',
       'CEO + THELMA','GitHub repository secret administration','docs/integrations/THELMA-CODEX-REPAIR-EXECUTOR.md',
       jsonb_build_object('plaintext_logged',false,'broad_pat_rejected',true,'workflow','.github/workflows/thelma-codex-repair.yml')
from public.ceo_organizations
on conflict (organization_id,finding_key) do update set
 status='BLOCKED',current_state=excluded.current_state,remediation_plan=excluded.remediation_plan,
 blocking_dependency=excluded.blocking_dependency,metadata=excluded.metadata,updated_at=now();

update public.analyst_findings
set status='IN_PROGRESS',
    current_state='Approval-linked repair ledger, bounded Codex workflow, path validator, test gate and PR-only output are installed. Dedicated GitHub Actions secret and first dry run remain.',
    remediation_plan='Install the dedicated OPENAI_API_KEY repository secret, execute one CEO-approved low-risk repair, require Quality Gate, and verify the production result through VERITAS.',
    blocking_dependency='THELMA-CODEX-GITHUB-SECRET-INSTALL',
    updated_at=now()
where finding_key='THELMA-CODE-REPAIR-EXECUTOR-MISSING';

insert into public.analyst_actions(
  organization_id,action_key,action_type,status,summary,actor,migration_version,test_ref,metadata,executed_at
)
select id,'THELMA-CODEX-EXECUTOR-CONTROL-PLANE-20260826','CONTROL_PLANE','COMPLETED',
       'Installed the CEO-approval-linked Codex repair request ledger, path boundaries, sandbox policy, PR-only GitHub workflow contract and evidence fields.',
       'Codex','20260826004500','tests/thelma-repair-policy.test.mjs',
       jsonb_build_object('merge_authority','CEO + Quality Gate','direct_main_write',false,'credential_state','AWAITING_GITHUB_SECRET'),now()
from public.ceo_organizations
on conflict (organization_id,action_key) do update set
 status='COMPLETED',summary=excluded.summary,metadata=excluded.metadata,executed_at=excluded.executed_at,updated_at=now();

insert into public.analyst_memory(
  organization_id,memory_key,system_key,category,title,summary,body,memory_state,trust_level,source_ref,provenance,tags,effective_at
)
select id,'THELMA-CODE-REPAIR-EXECUTOR-CONTRACT','SYS-THELMA-001','OPERATING_DOCTRINE',
       'THELMA code repair execution contract',
       'THELMA may propose code repairs but cannot approve herself, write to main, merge, or deploy directly.',
       'Every code repair requires a CEO-linked approval receipt, an isolated workspace-write sandbox, explicit allowed paths, forbidden credential/workflow paths, machine tests, a repair branch, a pull request, the Quality Gate, deployment evidence, and VERITAS verification. A GitHub Actions approval is not permission to merge.',
       'ACTIVE_CANON','VERIFIED','docs/integrations/THELMA-CODEX-REPAIR-EXECUTOR.md',
       jsonb_build_object('implemented_by','20260826004500_thelma_codex_repair_executor.sql','effective','2026-08-26'),
       array['thelma','codex','github','approval','sandbox','quality-gate','repair'],now()
from public.ceo_organizations
on conflict (organization_id,memory_key) do update set
 summary=excluded.summary,body=excluded.body,memory_state='ACTIVE_CANON',trust_level='VERIFIED',updated_at=now();

-- VisionWeaver Phase 2 — continuity-dissection gate
-- Separates expected prompt state from observed clip state.
-- Prevents Shot 02 from being generated until actual Shot 01 end-state is observed and approved.

create table if not exists public.vw_continuity_dissection_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.vw_projects(id) on delete cascade,
  generation_id uuid not null references public.vw_generations(id) on delete cascade,
  scene_state_id uuid not null references public.vw_avatar_scene_states(id) on delete cascade,
  storage_path text not null,
  expected_state jsonb not null default '{}'::jsonb,
  observed_state jsonb,
  discrepancy_report jsonb not null default '[]'::jsonb,
  media_access_state text not null default 'AVAILABLE_PRIVATE'
    check (media_access_state in ('AVAILABLE_PRIVATE','SIGNED_URL_READY','MEDIA_LOADED','MEDIA_UNAVAILABLE')),
  dissection_state text not null default 'WAITING_FOR_MEDIA'
    check (dissection_state in ('WAITING_FOR_MEDIA','READY','IN_PROGRESS','QC_PENDING','PASSED','FAILED','BLOCKED')),
  qc_state text not null default 'PENDING'
    check (qc_state in ('PENDING','PASS','FAIL','WAIVED')),
  error text,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(generation_id)
);

alter table public.vw_continuity_dissection_jobs enable row level security;
drop policy if exists vw_continuity_dissection_jobs_owner_all on public.vw_continuity_dissection_jobs;
create policy vw_continuity_dissection_jobs_owner_all
on public.vw_continuity_dissection_jobs
for all to authenticated
using (owner_id=auth.uid())
with check (owner_id=auth.uid());

create or replace function public.vw_continuity_gate_status(p_generation_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path=public
as $$
select jsonb_build_object(
 'generation_id',p_generation_id,
 'dissection_exists',exists(select 1 from vw_continuity_dissection_jobs where generation_id=p_generation_id),
 'media_access_state',coalesce((select media_access_state from vw_continuity_dissection_jobs where generation_id=p_generation_id),'NOT_REGISTERED'),
 'dissection_state',coalesce((select dissection_state from vw_continuity_dissection_jobs where generation_id=p_generation_id),'NOT_REGISTERED'),
 'qc_state',coalesce((select qc_state from vw_continuity_dissection_jobs where generation_id=p_generation_id),'NOT_REGISTERED'),
 'capsule_exists',exists(select 1 from vw_continuity_capsules where source_generation_id=p_generation_id),
 'capsule_locked',exists(select 1 from vw_continuity_capsules where source_generation_id=p_generation_id and approval_state='LOCKED'),
 'shot02_allowed',
   exists(select 1 from vw_continuity_dissection_jobs where generation_id=p_generation_id and dissection_state='PASSED' and qc_state='PASS')
   and exists(select 1 from vw_continuity_capsules where source_generation_id=p_generation_id and approval_state='LOCKED')
);
$$;

comment on function public.vw_continuity_gate_status(uuid) is
'Read-only gate proving whether a completed generation may seed the next continuation shot.';

with g as (
  select * from public.vw_generations where id='3b49444e-85de-4fe8-b7b1-31e36fc10c56'
), s as (
  select * from public.vw_avatar_scene_states
  where source_generation_id='3b49444e-85de-4fe8-b7b1-31e36fc10c56'
  order by created_at desc limit 1
)
insert into public.vw_continuity_dissection_jobs
(project_id,generation_id,scene_state_id,storage_path,expected_state,media_access_state,dissection_state,qc_state,owner_id)
select g.project_id,g.id,s.id,g.storage_paths[1],
 jsonb_build_object(
   'source_classification','EXPECTED_FROM_LOCKED_PROMPT_AND_AVATAR_STATE',
   'avatar',jsonb_build_object(
      'character_id',s.character_id,
      'identity','BOY-001 RAIN v02',
      'appearance_state_id',s.appearance_state_id,
      'wardrobe','yellow hooded raincoat / navy trousers / black rain boots',
      'body','fat seven-year-old Black boy; dark brown skin; tightly coiled black hair; full cheeks'),
   'prop',jsonb_build_object(
      'balloon_count',1,
      'balloon','red spherical helium balloon',
      'string','thin white',
      'hand','right',
      'released',false),
   'world',jsonb_build_object(
      'surface','wet brick sidewalk',
      'weather','steady rain',
      'lighting','cool natural overcast daylight'),
   'camera',jsonb_build_object(
      'movement','gentle backward tracking',
      'subject_relation','boy walks slowly toward camera'),
   'dialogue',false,
   'observed_state_required',true,
   'note','Expected state is not accepted as observed end-state. Actual media must be inspected before capsule approval.'
 ),
 'AVAILABLE_PRIVATE','WAITING_FOR_MEDIA','PENDING',g.owner_id
from g,s
on conflict(generation_id) do update set
 storage_path=excluded.storage_path,
 expected_state=excluded.expected_state,
 media_access_state='AVAILABLE_PRIVATE',
 dissection_state=case when vw_continuity_dissection_jobs.dissection_state in ('PASSED','QC_PENDING','IN_PROGRESS') then vw_continuity_dissection_jobs.dissection_state else 'WAITING_FOR_MEDIA' end,
 updated_at=now();

insert into public.production_log(run_id,phase,status,project_title,detail)
values(
 'VW-PHASE2-CONTINUITY-GATE-20261008',
 'continuity_dissection',
 'blocked_pending_observation',
 'Boy and Red Balloon — Shot 01 continuity',
 jsonb_build_object(
   'generation_id','3b49444e-85de-4fe8-b7b1-31e36fc10c56',
   'storage_present',true,
   'runway_task_retrieval','not_found',
   'provider_url','expired',
   'provider_spend',false,
   'shot02_allowed',false,
   'reason','actual stored clip end-state has not yet been visually observed and QC-approved'
 ));

select public.vw_continuity_gate_status('3b49444e-85de-4fe8-b7b1-31e36fc10c56'::uuid) as gate_status;

-- VisionWeaver Phase 2 — Avatar State runtime foundation
-- Additive only. Reconciles Avatar State v1.1 with existing vw_characters/vw_projects/vw_generations.
-- No provider call, publish action, credential value, or destructive change is performed here.

create table if not exists public.vw_character_detail_versions (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.vw_characters(id) on delete cascade,
  version integer not null check (version > 0),
  identity_anchors jsonb not null default '{}'::jsonb,
  visual_anchor text not null,
  allowed_changes jsonb not null default '[]'::jsonb,
  prohibited_changes jsonb not null default '[]'::jsonb,
  source_evidence jsonb not null default '{}'::jsonb,
  lifecycle_state text not null default 'DRAFT' check (lifecycle_state in ('DRAFT','GENERATED','QC_PENDING','APPROVED','LOCKED','NEEDS_REVISION','REJECTED','SUPERSEDED')),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(character_id,version)
);

create table if not exists public.vw_appearance_states (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.vw_characters(id) on delete cascade,
  detail_version_id uuid not null references public.vw_character_detail_versions(id),
  state_key text not null,
  version integer not null default 1 check (version > 0),
  parent_state_id uuid references public.vw_appearance_states(id),
  state_data jsonb not null default '{}'::jsonb,
  changed_fields text[] not null default '{}'::text[],
  lifecycle_state text not null default 'DRAFT' check (lifecycle_state in ('DRAFT','GENERATED','QC_PENDING','APPROVED','LOCKED','NEEDS_REVISION','REJECTED','SUPERSEDED')),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(character_id,state_key,version)
);

create table if not exists public.vw_voice_versions (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.vw_characters(id) on delete cascade,
  version integer not null check (version > 0),
  voice_status text not null default 'UNSPECIFIED' check (voice_status in ('UNSPECIFIED','NO_DIALOGUE','DEFINED','APPROVED','LOCKED','SUPERSEDED')),
  voice_data jsonb not null default '{}'::jsonb,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(character_id,version)
);

create table if not exists public.vw_performance_versions (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.vw_characters(id) on delete cascade,
  version integer not null check (version > 0),
  performance_data jsonb not null default '{}'::jsonb,
  lifecycle_state text not null default 'DRAFT' check (lifecycle_state in ('DRAFT','APPROVED','LOCKED','SUPERSEDED')),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(character_id,version)
);

create table if not exists public.vw_coverage_sets (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.vw_characters(id) on delete cascade,
  appearance_state_id uuid not null references public.vw_appearance_states(id),
  profile text not null check (profile in ('16_VIEW_STATE','24_VIEW_STUDY','32_VIEW_MASTER','64_SLOT_FULL_HEIGHT')),
  profile_version integer not null default 1,
  required_slots integer not null check (required_slots in (16,24,32,64)),
  completed_slots integer not null default 0 check (completed_slots >= 0),
  calibration_state text not null default 'NOT_REQUIRED' check (calibration_state in ('NOT_REQUIRED','PENDING','CALIBRATED')),
  manifest jsonb not null default '{}'::jsonb,
  lifecycle_state text not null default 'QC_PENDING' check (lifecycle_state in ('DRAFT','GENERATED','QC_PENDING','APPROVED','LOCKED','NEEDS_REVISION','REJECTED','SUPERSEDED')),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_slots <= required_slots),
  unique(character_id,appearance_state_id,profile,profile_version)
);

create table if not exists public.vw_view_assets (
  id uuid primary key default gen_random_uuid(),
  coverage_set_id uuid not null references public.vw_coverage_sets(id) on delete cascade,
  slot_key text not null,
  asset_ref text not null,
  asset_version text,
  sha256 text,
  camera_metadata jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  qc_state text not null default 'PENDING' check (qc_state in ('PENDING','PASS','FAIL','WAIVED')),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(coverage_set_id,slot_key)
);

create table if not exists public.vw_avatar_runtime_bindings (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null unique references public.vw_characters(id) on delete cascade,
  active_detail_version_id uuid not null references public.vw_character_detail_versions(id),
  active_appearance_state_id uuid not null references public.vw_appearance_states(id),
  active_voice_version_id uuid references public.vw_voice_versions(id),
  active_performance_version_id uuid references public.vw_performance_versions(id),
  active_coverage_set_id uuid references public.vw_coverage_sets(id),
  binding_state text not null default 'PENDING' check (binding_state in ('PENDING','ACTIVE','BLOCKED','SUPERSEDED')),
  activation_evidence jsonb not null default '{}'::jsonb,
  owner_id uuid not null references auth.users(id),
  activated_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.vw_cast_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.vw_projects(id) on delete cascade,
  scene_key text not null,
  version integer not null default 1 check (version > 0),
  cast_entries jsonb not null default '[]'::jsonb,
  world_ref jsonb not null default '{}'::jsonb,
  lifecycle_state text not null default 'DRAFT' check (lifecycle_state in ('DRAFT','QC_PENDING','APPROVED','LOCKED','NEEDS_REVISION','REJECTED','SUPERSEDED')),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(project_id,scene_key,version)
);

create table if not exists public.vw_avatar_scene_states (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.vw_projects(id) on delete cascade,
  cast_version_id uuid not null references public.vw_cast_versions(id) on delete cascade,
  character_id uuid not null references public.vw_characters(id),
  detail_version_id uuid not null references public.vw_character_detail_versions(id),
  appearance_state_id uuid not null references public.vw_appearance_states(id),
  voice_version_id uuid references public.vw_voice_versions(id),
  performance_version_id uuid references public.vw_performance_versions(id),
  source_generation_id uuid references public.vw_generations(id),
  start_state jsonb not null default '{}'::jsonb,
  end_state jsonb,
  state_status text not null default 'PENDING_DISSECTION' check (state_status in ('PENDING_DISSECTION','DISSECTED','QC_PENDING','APPROVED','LOCKED','SUPERSEDED')),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vw_continuity_capsules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.vw_projects(id) on delete cascade,
  source_generation_id uuid not null references public.vw_generations(id),
  source_scene_state_id uuid not null references public.vw_avatar_scene_states(id),
  capsule_version integer not null default 1,
  capsule jsonb not null,
  approval_state text not null default 'PENDING' check (approval_state in ('PENDING','APPROVED','LOCKED','REJECTED','SUPERSEDED')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(source_generation_id,capsule_version)
);

alter table public.vw_character_detail_versions enable row level security;
alter table public.vw_appearance_states enable row level security;
alter table public.vw_voice_versions enable row level security;
alter table public.vw_performance_versions enable row level security;
alter table public.vw_coverage_sets enable row level security;
alter table public.vw_view_assets enable row level security;
alter table public.vw_avatar_runtime_bindings enable row level security;
alter table public.vw_cast_versions enable row level security;
alter table public.vw_avatar_scene_states enable row level security;
alter table public.vw_continuity_capsules enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'vw_character_detail_versions','vw_appearance_states','vw_voice_versions','vw_performance_versions',
    'vw_coverage_sets','vw_view_assets','vw_avatar_runtime_bindings','vw_cast_versions',
    'vw_avatar_scene_states','vw_continuity_capsules'
  ] loop
    execute format('drop policy if exists %I on public.%I', t||'_owner_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t||'_owner_all', t);
  end loop;
end $$;

create or replace function public.vw_avatar_activation_check(p_character_id uuid,p_project_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path=public
as $$
with b as (
 select rb.*,d.lifecycle_state as detail_state,a.lifecycle_state as appearance_state,
        v.voice_status,p.lifecycle_state as performance_state,c.lifecycle_state as coverage_state
 from vw_avatar_runtime_bindings rb
 join vw_character_detail_versions d on d.id=rb.active_detail_version_id
 join vw_appearance_states a on a.id=rb.active_appearance_state_id
 left join vw_voice_versions v on v.id=rb.active_voice_version_id
 left join vw_performance_versions p on p.id=rb.active_performance_version_id
 left join vw_coverage_sets c on c.id=rb.active_coverage_set_id
 where rb.character_id=p_character_id
), cv as (
 select count(*)::int as n from vw_cast_versions
 where project_id=p_project_id and lifecycle_state in ('APPROVED','LOCKED')
), g as (
 select count(*)::int as n from vw_generations
 where project_id=p_project_id and status='complete'
)
select jsonb_build_object(
 'character_id',p_character_id,
 'project_id',p_project_id,
 'binding_active',coalesce((select binding_state='ACTIVE' from b),false),
 'detail_locked',coalesce((select detail_state='LOCKED' from b),false),
 'appearance_locked',coalesce((select appearance_state='LOCKED' from b),false),
 'voice_resolved',coalesce((select voice_status in ('NO_DIALOGUE','DEFINED','APPROVED','LOCKED') from b),false),
 'performance_resolved',coalesce((select performance_state in ('APPROVED','LOCKED') from b),false),
 'coverage_state',coalesce((select coverage_state from b),'NOT_BOUND'),
 'cast_assigned',(select n>0 from cv),
 'completed_generation_exists',(select n>0 from g),
 'ready_for_world_dissection',
   coalesce((select binding_state='ACTIVE' and detail_state='LOCKED' and appearance_state='LOCKED'
     and voice_status in ('NO_DIALOGUE','DEFINED','APPROVED','LOCKED')
     and performance_state in ('APPROVED','LOCKED') from b),false)
   and (select n>0 from cv) and (select n>0 from g)
);
$$;

comment on function public.vw_avatar_activation_check(uuid,uuid) is
'Non-spending VisionWeaver Avatar State acceptance check. Does not call providers or grant approval authority.';

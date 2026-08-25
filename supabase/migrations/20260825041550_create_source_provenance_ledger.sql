create table if not exists public.source_provenance (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.ceo_organizations(id) on delete cascade,
  source_key text not null, source_name text not null, source_type text not null check(source_type in ('OWNED_REPOSITORY','OWNED_DRIVE_SOURCE','PUBLIC_REPOSITORY','COMMERCIAL_REFERENCE','PUBLIC_DOCUMENTATION','OTHER')),
  source_location text not null, source_commit text, license_id text,
  license_state text not null default 'UNKNOWN_PENDING_REVIEW' check(license_state in ('OWNED','VERIFIED_PERMISSIVE','VERIFIED_RESTRICTED','UNKNOWN_PENDING_REVIEW','NOT_APPLICABLE')),
  use_classification text not null check(use_classification in ('OWNED_CODE','PERMISSIVE_REUSE','REFERENCE_ONLY','RESTRICTED','UNKNOWN_PENDING_REVIEW')),
  attribution_required boolean not null default true, code_reuse_allowed boolean not null default false, copied_or_transformed_paths text[] not null default '{}'::text[],
  rationale text, evidence jsonb not null default '{}'::jsonb, last_verified_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,source_key)
);
create index if not exists source_provenance_class_idx on public.source_provenance(organization_id,use_classification,license_state);
alter table public.source_provenance enable row level security;
create policy source_provenance_member_select on public.source_provenance for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy source_provenance_member_insert on public.source_provenance for insert to authenticated with check(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=organization_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy source_provenance_member_update on public.source_provenance for update to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=organization_id and m.user_id=(select auth.uid()) and m.status='active')) with check(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=organization_id and m.user_id=(select auth.uid()) and m.status='active'));
grant select,insert,update on public.source_provenance to authenticated; grant all on public.source_provenance to service_role;

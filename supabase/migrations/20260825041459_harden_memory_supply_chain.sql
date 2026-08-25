alter table public.system_memory add column if not exists memory_state text not null default 'HISTORICAL';
alter table public.system_memory add column if not exists trust_level text not null default 'UNVERIFIED';
alter table public.system_memory add column if not exists review_state text not null default 'PENDING';
alter table public.system_memory add column if not exists source_classification text not null default 'LEGACY_MEMORY';
alter table public.system_memory add column if not exists source_hash text;
alter table public.system_memory add column if not exists provenance jsonb not null default '{}'::jsonb;
alter table public.system_memory add column if not exists effective_at timestamptz;
alter table public.system_memory add column if not exists last_verified_at timestamptz;
alter table public.system_memory add column if not exists reviewed_at timestamptz;
alter table public.system_memory add column if not exists reviewed_by text;
alter table public.system_memory add column if not exists sanitized_at timestamptz;
alter table public.system_memory add column if not exists superseded_by bigint references public.system_memory(id);
do $$ begin
 if not exists(select 1 from pg_constraint where conname='system_memory_memory_state_check') then alter table public.system_memory add constraint system_memory_memory_state_check check(memory_state in ('ACTIVE_CANON','SUPERSEDED','HISTORICAL','EXPERIMENTAL','QUARANTINED','DUPLICATE','REJECTED')); end if;
 if not exists(select 1 from pg_constraint where conname='system_memory_trust_level_check') then alter table public.system_memory add constraint system_memory_trust_level_check check(trust_level in ('VERIFIED','INFERRED','UNVERIFIED')); end if;
 if not exists(select 1 from pg_constraint where conname='system_memory_review_state_check') then alter table public.system_memory add constraint system_memory_review_state_check check(review_state in ('PENDING','APPROVED','REJECTED','REVIEW_REQUIRED')); end if;
end $$;
update public.system_memory set source_hash=md5(coalesce(title,'')||'|'||coalesce(body,'')||'|'||coalesce(source_ref,'')),provenance=coalesce(provenance,'{}'::jsonb)||jsonb_build_object('legacy_id',id,'captured_before_supply_chain_controls',true),effective_at=coalesce(effective_at,created_at) where source_hash is null;
update public.system_memory set memory_state='QUARANTINED',trust_level='UNVERIFIED',review_state='REVIEW_REQUIRED',last_verified_at=null,updated_at=now() where title<>'Analyst Memory Bank — Canonical Reference' and is_canonical=true;
update public.system_memory set memory_state='HISTORICAL',trust_level='UNVERIFIED',review_state='PENDING',updated_at=now() where is_canonical=false;
update public.system_memory set memory_state='SUPERSEDED',trust_level='UNVERIFIED',review_state='REJECTED',is_canonical=false,updated_at=now(),provenance=provenance||jsonb_build_object('supersession_reason','Explicitly stale operational procedure or dated runtime state identified during Quantico reconstruction') where id in (3,5,6,16,19,22,26,27,28);
update public.system_memory set memory_state='ACTIVE_CANON',trust_level='VERIFIED',review_state='APPROVED',source_classification='INTERNAL_CANON',last_verified_at=now(),reviewed_at=now(),reviewed_by='Architect-directed reconstruction',sanitized_at=now(),is_canonical=true,updated_at=now() where title='Analyst Memory Bank — Canonical Reference';
create table if not exists public.memory_ingestion_sources (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.ceo_organizations(id) on delete cascade,source_key text not null,source_type text not null,
 trust_tier text not null check(trust_tier in ('INTERNAL_VERIFIED','INTERNAL_UNVERIFIED','EXTERNAL_TRUSTED','EXTERNAL_UNTRUSTED','QUARANTINED')),source_ref text not null,
 allowed_for_canon boolean not null default false,sanitization_required boolean not null default true,notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,source_key)
);
alter table public.memory_ingestion_sources enable row level security;
create policy memory_ingestion_sources_member_select on public.memory_ingestion_sources for select to authenticated using(exists(select 1 from public.ceo_organization_memberships m where m.organization_id=organization_id and m.user_id=(select auth.uid()) and m.status='active'));
grant select on public.memory_ingestion_sources to authenticated; grant all on public.memory_ingestion_sources to service_role;
create or replace view public.active_canonical_memory with (security_invoker=true) as select * from public.system_memory where is_canonical=true and memory_state='ACTIVE_CANON' and trust_level='VERIFIED' and review_state='APPROVED';
grant select on public.active_canonical_memory to authenticated,service_role;

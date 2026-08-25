alter table recovery.security_findings
  add column if not exists observed_at timestamptz,
  add column if not exists observed_release text,
  add column if not exists last_verified_at timestamptz,
  add column if not exists verification_state text not null default 'STALE_UNVERIFIED',
  add column if not exists verification_evidence jsonb not null default '{}'::jsonb,
  add column if not exists remediation_ref text,
  add column if not exists regression_test_ref text;

alter table recovery.security_findings
  drop constraint if exists security_findings_verification_state_check;

alter table recovery.security_findings
  add constraint security_findings_verification_state_check
  check (verification_state in ('OPEN','FIXED','REGRESSED','SUPERSEDED','STALE_UNVERIFIED'));

update recovery.security_findings
set observed_at = coalesce(observed_at, created_at),
    observed_release = coalesce(observed_release, 'historical-pre-2026-08-24'),
    last_verified_at = now(),
    verification_state = case
      when finding_key in ('VW-RLS-PROJECTS','VW-RLS-ENVIRONMENTS','VW-RLS-RENDERS','VW-RLS-SCENES','VW-RLS-CHARACTERS','VW-RLS-TEMPLATES','VW-RLS-DISTRIBUTION','DASHBOARD-EDGE-JWT-REVIEW') then 'FIXED'
      when finding_key in ('AUTH-LEAKED-PASSWORD-PROTECTION','HISTORICAL-PLAINTEXT-SECRETS','VW-EDGE-JWT-REVIEW','OAUTH-CALLBACK-AUTH-REVIEW') then 'OPEN'
      else 'STALE_UNVERIFIED'
    end,
    verification_evidence = case
      when finding_key like 'VW-RLS-%' then jsonb_build_object('verified_2026_08_24','live pg_policies shows current VisionWeaver policies; original no-policy claim no longer describes live schema')
      when finding_key = 'DASHBOARD-EDGE-JWT-REVIEW' then jsonb_build_object('verified_2026_08_24','Supabase Edge Function registry reports dashboard-data verify_jwt=true')
      when finding_key = 'AUTH-LEAKED-PASSWORD-PROTECTION' then jsonb_build_object('verified_2026_08_24','Supabase security advisor still reports leaked-password protection disabled')
      when finding_key = 'VW-EDGE-JWT-REVIEW' then jsonb_build_object('verified_2026_08_24','visionweaver-orchestrator remains verify_jwt=false; custom signed boundary requires explicit review')
      when finding_key = 'OAUTH-CALLBACK-AUTH-REVIEW' then jsonb_build_object('verified_2026_08_24','oauth-callback remains verify_jwt=false by protocol; state/replay/redirect validation remains required')
      else verification_evidence
    end,
    updated_at = now();

create or replace view recovery.active_security_findings as
select *
from recovery.security_findings
where verification_state in ('OPEN','REGRESSED');

comment on view recovery.active_security_findings is 'Only currently verified open or regressed findings. Autonomous remediation must not consume STALE_UNVERIFIED or SUPERSEDED findings as current truth.';

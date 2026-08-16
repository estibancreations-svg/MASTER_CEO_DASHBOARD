create table if not exists recovery.backup_policies (
  policy_key text primary key,
  asset_scope text not null,
  backup_method text not null,
  target_location text not null,
  rpo_hours integer not null check (rpo_hours between 1 and 720),
  rto_hours integer not null check (rto_hours between 1 and 720),
  retention_days integer not null check (retention_days between 1 and 3650),
  schedule_text text not null,
  activation_state text not null default 'planned' check (activation_state in ('planned','ready','active','paused','retired')),
  verification_state text not null default 'not_tested' check (verification_state in ('not_tested','configured','verified','failed')),
  last_verified_at timestamptz,
  owner text not null default 'The Architect',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recovery.backup_runs (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null references recovery.backup_policies(policy_key),
  run_type text not null default 'manual' check (run_type in ('manual','scheduled','platform')),
  status text not null default 'planned' check (status in ('planned','running','succeeded','failed','verified')),
  started_at timestamptz,
  completed_at timestamptz,
  artifact_ref text,
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  row_count bigint check (row_count is null or row_count >= 0),
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  initiated_by text not null default current_user,
  evidence_ref text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

create table if not exists recovery.restore_drills (
  id uuid primary key default gen_random_uuid(),
  backup_run_id uuid references recovery.backup_runs(id),
  target_environment text not null check (target_environment in ('local','staging','temporary_project')),
  status text not null default 'planned' check (status in ('planned','running','succeeded','failed')),
  started_at timestamptz,
  completed_at timestamptz,
  schema_verified boolean not null default false,
  row_counts_verified boolean not null default false,
  rls_verified boolean not null default false,
  storage_verified boolean not null default false,
  vault_portability_verified boolean not null default false,
  evidence_ref text,
  approved_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or started_at is null or completed_at >= started_at),
  check (status <> 'succeeded' or (schema_verified and row_counts_verified and rls_verified))
);

create table if not exists recovery.recovery_events (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('backup_policy','backup_run','restore_drill')),
  entity_id text not null,
  event_type text not null,
  from_state text,
  to_state text,
  actor text not null default current_user,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists backup_runs_policy_created_idx on recovery.backup_runs(policy_key, created_at desc);
create index if not exists backup_runs_status_idx on recovery.backup_runs(status, created_at desc);
create index if not exists restore_drills_status_idx on recovery.restore_drills(status, created_at desc);
create index if not exists recovery_events_entity_idx on recovery.recovery_events(entity_type, entity_id, created_at desc);

alter table recovery.backup_policies enable row level security;
alter table recovery.backup_runs enable row level security;
alter table recovery.restore_drills enable row level security;
alter table recovery.recovery_events enable row level security;

revoke all on recovery.backup_policies, recovery.backup_runs, recovery.restore_drills, recovery.recovery_events from public, anon, authenticated;
grant usage on schema recovery to service_role;
grant select, insert, update on recovery.backup_policies, recovery.backup_runs, recovery.restore_drills to service_role;
grant select, insert on recovery.recovery_events to service_role;
grant usage, select on sequence recovery.recovery_events_id_seq to service_role;

create or replace function recovery.prevent_recovery_event_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'recovery_events is append-only';
end;
$$;

revoke all on function recovery.prevent_recovery_event_mutation() from public, anon, authenticated;
grant execute on function recovery.prevent_recovery_event_mutation() to service_role;

drop trigger if exists recovery_events_append_only on recovery.recovery_events;
create trigger recovery_events_append_only before update or delete on recovery.recovery_events
for each row execute function recovery.prevent_recovery_event_mutation();

create or replace function recovery.capture_recovery_state()
returns trigger language plpgsql set search_path = ''
as $$
declare
  entity_type_value text;
  entity_id_value text;
  old_state_value text;
  new_state_value text;
begin
  if tg_table_name = 'backup_policies' then
    entity_type_value := 'backup_policy';
    entity_id_value := new.policy_key;
    old_state_value := case when tg_op = 'INSERT' then null else old.activation_state end;
    new_state_value := new.activation_state;
  elsif tg_table_name = 'backup_runs' then
    entity_type_value := 'backup_run';
    entity_id_value := new.id::text;
    old_state_value := case when tg_op = 'INSERT' then null else old.status end;
    new_state_value := new.status;
  else
    entity_type_value := 'restore_drill';
    entity_id_value := new.id::text;
    old_state_value := case when tg_op = 'INSERT' then null else old.status end;
    new_state_value := new.status;
  end if;

  if tg_op = 'INSERT' or old_state_value is distinct from new_state_value then
    insert into recovery.recovery_events(entity_type, entity_id, event_type, from_state, to_state, actor)
    values (entity_type_value, entity_id_value, lower(tg_op), old_state_value, new_state_value, current_user);
  end if;
  return new;
end;
$$;

revoke all on function recovery.capture_recovery_state() from public, anon, authenticated;
grant execute on function recovery.capture_recovery_state() to service_role;

drop trigger if exists capture_backup_policy_state on recovery.backup_policies;
create trigger capture_backup_policy_state after insert or update on recovery.backup_policies
for each row execute function recovery.capture_recovery_state();

drop trigger if exists capture_backup_run_state on recovery.backup_runs;
create trigger capture_backup_run_state after insert or update on recovery.backup_runs
for each row execute function recovery.capture_recovery_state();

drop trigger if exists capture_restore_drill_state on recovery.restore_drills;
create trigger capture_restore_drill_state after insert or update on recovery.restore_drills
for each row execute function recovery.capture_recovery_state();

insert into recovery.backup_policies(policy_key, asset_scope, backup_method, target_location, rpo_hours, rto_hours, retention_days, schedule_text, activation_state, verification_state, notes)
values
 ('supabase-platform-database','Postgres database including Vault ciphertext','Supabase platform physical backup or PITR','Supabase managed backup storage',24,8,7,'Daily when plan supports it','planned','not_tested','Confirm the project plan and available restore points in Database > Backups before activation.'),
 ('supabase-logical-database','Roles, schema and application data','Supabase CLI db dump','Encrypted operator-controlled archive',24,8,30,'Daily after backup credentials and destination are approved','planned','not_tested','Do not commit SQL dumps to source. Vault portability requires the source project root key when restoring manually to a different project.'),
 ('supabase-storage-objects','Storage bucket objects; database backups include metadata only','Storage object export','Encrypted operator-controlled archive',24,8,30,'Daily after storage is used for production assets','planned','not_tested','Database restore alone does not restore deleted Storage objects.'),
 ('github-source','Application source, migrations and operational documentation','Git commits and protected main history','Private GitHub repository',1,2,365,'Every approved merge','active','verified','Merged source history and Vercel rollback candidates provide application rollback points.'),
 ('vercel-release','Built application release','Immutable deployment history','Vercel deployment retention',1,2,30,'Every deployment','active','verified','Rollback readiness verified through READY production candidates; destructive production rollback was not exercised.')
on conflict (policy_key) do update set
 asset_scope=excluded.asset_scope,
 backup_method=excluded.backup_method,
 target_location=excluded.target_location,
 rpo_hours=excluded.rpo_hours,
 rto_hours=excluded.rto_hours,
 retention_days=excluded.retention_days,
 schedule_text=excluded.schedule_text,
 activation_state=excluded.activation_state,
 verification_state=excluded.verification_state,
 notes=excluded.notes,
 updated_at=now();

comment on table recovery.backup_policies is 'Private RPO/RTO and activation truth for database, storage, source and release recovery.';
comment on table recovery.backup_runs is 'Private evidence ledger for logical, scheduled and platform backup runs. No secret values are stored.';
comment on table recovery.restore_drills is 'Private non-production restore-drill evidence. Production is intentionally excluded as a drill target.';
comment on table recovery.recovery_events is 'Append-only state history for recovery policies, backup runs and restore drills.';

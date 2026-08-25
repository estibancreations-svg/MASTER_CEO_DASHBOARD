create table if not exists recovery.backup_manifest_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_project text not null default 'yqealeekngxooyoemfba',
  captured_at timestamptz not null default now(),
  public_table_count integer not null,
  rls_table_count integer not null,
  migration_count integer not null,
  storage_bucket_count integer not null,
  key_row_counts jsonb not null default '{}'::jsonb,
  schema_fingerprint text not null,
  notes text
);
create table if not exists recovery.restore_assertions (
  id uuid primary key default gen_random_uuid(),
  drill_id uuid references recovery.restore_drills(id) on delete cascade,
  assertion_key text not null,
  expected jsonb not null default '{}'::jsonb,
  actual jsonb not null default '{}'::jsonb,
  passed boolean not null default false,
  evidence_ref text,
  checked_at timestamptz not null default now(),
  unique(drill_id,assertion_key)
);
alter table recovery.backup_manifest_snapshots enable row level security;
alter table recovery.restore_assertions enable row level security;

#!/usr/bin/env bash
set -euo pipefail

: "${RESTORE_DB_URL:?Set RESTORE_DB_URL to a non-production target connection string.}"
: "${AGE_IDENTITY_FILE:?Set AGE_IDENTITY_FILE to the offline age private identity file.}"
: "${ALLOW_RESTORE_DRILL:?Set ALLOW_RESTORE_DRILL=YES after confirming the target is disposable.}"

encrypted_backup="${1:-}"
if [[ "$ALLOW_RESTORE_DRILL" != "YES" ]]; then
  echo "Restore drill requires ALLOW_RESTORE_DRILL=YES." >&2
  exit 77
fi
if [[ -z "$encrypted_backup" || ! -f "$encrypted_backup" ]]; then
  echo "Usage: bash scripts/restore-supabase-drill.sh /absolute/path/backup.tar.gz.age" >&2
  exit 64
fi
if [[ "$RESTORE_DB_URL" == *"yqealeekngxooyoemfba"* ]]; then
  echo "Refusing to run a drill against the production project." >&2
  exit 77
fi

for command_name in psql age tar sha256sum; do
  command -v "$command_name" >/dev/null || { echo "Missing required command: $command_name" >&2; exit 69; }
done

checksum_file="$encrypted_backup.sha256"
if [[ -f "$checksum_file" ]]; then
  (cd "$(dirname "$encrypted_backup")" && sha256sum -c "$(basename "$checksum_file")")
else
  echo "Checksum file not found; refusing unverifiable restore input." >&2
  exit 65
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

age -d -i "$AGE_IDENTITY_FILE" -o "$work_dir/backup.tar.gz" "$encrypted_backup"
tar -xzf "$work_dir/backup.tar.gz" -C "$work_dir"

for required_file in roles.sql schema.sql data.sql history_schema.sql history_data.sql manifest.txt; do
  [[ -f "$work_dir/$required_file" ]] || { echo "Missing backup member: $required_file" >&2; exit 65; }
done

psql --single-transaction --variable ON_ERROR_STOP=1   --file "$work_dir/roles.sql"   --file "$work_dir/schema.sql"   --command 'SET session_replication_role = replica'   --file "$work_dir/data.sql"   --dbname "$RESTORE_DB_URL"

psql --single-transaction --variable ON_ERROR_STOP=1   --file "$work_dir/history_schema.sql"   --file "$work_dir/history_data.sql"   --dbname "$RESTORE_DB_URL"

source_tables="$(awk -F= '$1=="public_tables"{print $2}' "$work_dir/manifest.txt")"
source_rls="$(awk -F= '$1=="rls_tables"{print $2}' "$work_dir/manifest.txt")"
target_counts="$(psql "$RESTORE_DB_URL" -At -F= -c "select (select count(*) from pg_tables where schemaname='public'),(select count(*) from pg_tables where schemaname='public' and rowsecurity);")"
target_tables="${target_counts%%=*}"
target_rls="${target_counts##*=}"

if [[ "$source_tables" != "$target_tables" || "$source_rls" != "$target_rls" ]]; then
  echo "Restore verification failed: source tables/RLS=$source_tables/$source_rls target=$target_tables/$target_rls" >&2
  exit 1
fi

echo "Restore drill passed schema and RLS counts: $target_tables/$target_rls"
echo "Next: verify row counts, Storage objects, Realtime publications, Edge Functions, and Vault root-key portability before recording the drill as succeeded."

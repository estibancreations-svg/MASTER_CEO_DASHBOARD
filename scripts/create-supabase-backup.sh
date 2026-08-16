#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the project connection string.}"
: "${BACKUP_AGE_RECIPIENT:?Set BACKUP_AGE_RECIPIENT to the public age recipient.}"

output_dir="${1:-}"
if [[ -z "$output_dir" ]]; then
  echo "Usage: bash scripts/create-supabase-backup.sh /absolute/operator-controlled/output-directory" >&2
  exit 64
fi
if [[ "$output_dir" != /* ]]; then
  echo "Output directory must be an absolute path." >&2
  exit 64
fi

for command_name in supabase psql age tar sha256sum; do
  command -v "$command_name" >/dev/null || { echo "Missing required command: $command_name" >&2; exit 69; }
done

mkdir -p "$output_dir"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
artifact="master-dashboard-supabase-$stamp"
encrypted_path="$output_dir/$artifact.tar.gz.age"

supabase db dump --db-url "$SUPABASE_DB_URL" -f "$work_dir/roles.sql" --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$work_dir/schema.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$work_dir/data.sql" --data-only --use-copy -x "storage.buckets_vectors" -x "storage.vector_indexes"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$work_dir/history_schema.sql" --schema supabase_migrations
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$work_dir/history_data.sql" --data-only --use-copy --schema supabase_migrations

psql "$SUPABASE_DB_URL" -At -F= -c "select 'public_tables',count(*) from pg_tables where schemaname='public' union all select 'rls_tables',count(*) from pg_tables where schemaname='public' and rowsecurity union all select 'migration_rows',count(*) from supabase_migrations.schema_migrations;" > "$work_dir/manifest.txt"
printf 'created_at=%s\nsource_project=%s\n' "$stamp" "yqealeekngxooyoemfba" >> "$work_dir/manifest.txt"

tar -C "$work_dir" -czf "$work_dir/$artifact.tar.gz" roles.sql schema.sql data.sql history_schema.sql history_data.sql manifest.txt
age -r "$BACKUP_AGE_RECIPIENT" -o "$encrypted_path" "$work_dir/$artifact.tar.gz"
(cd "$output_dir" && sha256sum "$(basename "$encrypted_path")" > "$(basename "$encrypted_path").sha256")
chmod 600 "$encrypted_path" "$encrypted_path.sha256"

echo "Encrypted backup created:"
echo "$encrypted_path"
echo "Store the age private identity offline. Never commit either the decrypted dump or the private identity."

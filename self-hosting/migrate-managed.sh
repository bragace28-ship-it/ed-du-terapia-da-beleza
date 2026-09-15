#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_DB_URL:?Set SOURCE_DB_URL to the managed Supabase connection string}"
: "${TARGET_DB_URL:?Set TARGET_DB_URL to the self-hosted Postgres connection string}"

mkdir -p backups/managed-$(date +%Y%m%d-%H%M%S)
OUT="$(find backups -maxdepth 1 -type d -name 'managed-*' | sort | tail -n1)"

echo '[1/3] Exporting roles...'
supabase db dump --db-url "$SOURCE_DB_URL" -f "$OUT/roles.sql" --role-only

echo '[2/3] Exporting schema...'
supabase db dump --db-url "$SOURCE_DB_URL" -f "$OUT/schema.sql"

echo '[3/3] Exporting data...'
supabase db dump --db-url "$SOURCE_DB_URL" -f "$OUT/data.sql" --use-copy --data-only

printf '\nBackup created at %s\n' "$OUT"
printf 'Restore only after the self-hosted instance has been validated:\n'
printf 'psql --single-transaction --variable ON_ERROR_STOP=1 --file %s --file %s --command "SET session_replication_role = replica" --file %s --dbname "$TARGET_DB_URL"\n' "$OUT/roles.sql" "$OUT/schema.sql" "$OUT/data.sql"

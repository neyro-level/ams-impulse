#!/usr/bin/env bash
set -euo pipefail

required=(
  TIMEWEB_BACKUP_ID
  TIMEWEB_SOURCE_DATABASE_ID
  TIMEWEB_RESTORE_TARGET_ID
  RESTORE_DATABASE_HOST
  RESTORE_DATABASE_USER
  RESTORE_DATABASE_PASSWORD
  RESTORE_DATABASE_NAME
  PRODUCTION_DATABASE_HOST
  PRODUCTION_DATABASE_NAME
  RESTORE_APP_BASE_URL
  RESTORE_PROOF_FILE
)
for key in "${required[@]}"; do
  if [ -z "${!key:-}" ]; then
    echo "${key,,}_missing=true" >&2
    exit 1
  fi
done

if [ "$TIMEWEB_SOURCE_DATABASE_ID" = "$TIMEWEB_RESTORE_TARGET_ID" ]; then
  echo "restore_target_is_source=true" >&2
  exit 1
fi
if [ "$RESTORE_DATABASE_HOST" = "$PRODUCTION_DATABASE_HOST" ] && [ "$RESTORE_DATABASE_NAME" = "$PRODUCTION_DATABASE_NAME" ]; then
  echo "restore_target_is_production=true" >&2
  exit 1
fi
if ! [[ "$RESTORE_APP_BASE_URL" =~ ^https?://(127\.0\.0\.1|localhost|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.) ]]; then
  echo "restore_app_target_not_private=true" >&2
  exit 1
fi
if ! command -v psql >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
  echo "restore_proof_dependency_missing=true" >&2
  exit 1
fi

export PGHOST="$RESTORE_DATABASE_HOST"
export PGPORT="${RESTORE_DATABASE_PORT:-5432}"
export PGUSER="$RESTORE_DATABASE_USER"
export PGPASSWORD="$RESTORE_DATABASE_PASSWORD"
export PGDATABASE="$RESTORE_DATABASE_NAME"
export PGSSLMODE="${RESTORE_DATABASE_SSLMODE:-require}"

SQL_RESULT="$(psql --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align --field-separator='|' <<'SQL'
SELECT current_setting('server_version_num')::integer,
       (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
       (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'),
       to_regclass('public."User"') IS NOT NULL,
       to_regclass('public."Project"') IS NOT NULL,
       to_regclass('public."Site"') IS NOT NULL,
       to_regclass('public."ReportSnapshot"') IS NOT NULL,
       to_regclass('public."OutboxEvent"') IS NOT NULL,
       (SELECT count(*) FROM "Project"),
       (SELECT count(*) FROM "Site"),
       (SELECT count(*) FROM "ReportSnapshot");
SQL
)"
IFS='|' read -r VERSION_NUM MIGRATION_COUNT TABLE_COUNT USER_TABLE PROJECT_TABLE SITE_TABLE REPORT_TABLE OUTBOX_TABLE PROJECT_COUNT SITE_COUNT REPORT_COUNT <<<"$SQL_RESULT"

if [ "${VERSION_NUM:-0}" -lt 180000 ]; then
  echo "restore_postgresql_major_invalid=${VERSION_NUM:-missing}" >&2
  exit 1
fi
if [ "${MIGRATION_COUNT:-0}" -lt 1 ] || [ "${TABLE_COUNT:-0}" -lt 1 ]; then
  echo "restore_schema_incomplete=true" >&2
  exit 1
fi
for present in "$USER_TABLE" "$PROJECT_TABLE" "$SITE_TABLE" "$REPORT_TABLE" "$OUTBOX_TABLE"; do
  if [ "$present" != "t" ]; then
    echo "restore_critical_table_missing=true" >&2
    exit 1
  fi
done
if [ "$PROJECT_COUNT" -lt "${MIN_PROJECT_COUNT:-1}" ] || [ "$SITE_COUNT" -lt "${MIN_SITE_COUNT:-1}" ] || [ "$REPORT_COUNT" -lt "${MIN_REPORT_COUNT:-1}" ]; then
  echo "restore_row_sanity_failed=true" >&2
  exit 1
fi

READY_PAYLOAD="$(curl --fail --silent --show-error --max-time 15 "${RESTORE_APP_BASE_URL%/}/api/health/ready")"
python3 - "$READY_PAYLOAD" <<'PY'
import json
import sys

payload = json.loads(sys.argv[1])
dependencies = payload.get("dependencies", {})
if payload.get("status") != "ready" or dependencies.get("postgresql") != "ready":
    raise SystemExit("restore_application_not_ready=true")
PY

export RESTORE_VERSION_NUM="$VERSION_NUM"
export RESTORE_MIGRATION_COUNT="$MIGRATION_COUNT"
export RESTORE_TABLE_COUNT="$TABLE_COUNT"
export RESTORE_PROJECT_COUNT="$PROJECT_COUNT"
export RESTORE_SITE_COUNT="$SITE_COUNT"
export RESTORE_REPORT_COUNT="$REPORT_COUNT"
python3 - <<'PY'
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

proof_path = Path(os.environ["RESTORE_PROOF_FILE"])
proof_path.parent.mkdir(parents=True, exist_ok=True)
payload = {
    "schemaVersion": 1,
    "kind": "managed-postgres-isolated-restore",
    "provider": "timeweb-cloud",
    "backupId": os.environ["TIMEWEB_BACKUP_ID"],
    "sourceRef": hashlib.sha256(os.environ["TIMEWEB_SOURCE_DATABASE_ID"].encode()).hexdigest()[:16],
    "targetRef": hashlib.sha256(os.environ["TIMEWEB_RESTORE_TARGET_ID"].encode()).hexdigest()[:16],
    "verifiedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "postgresqlVersionNum": int(os.environ["RESTORE_VERSION_NUM"]),
    "migrationCount": int(os.environ["RESTORE_MIGRATION_COUNT"]),
    "publicTableCount": int(os.environ["RESTORE_TABLE_COUNT"]),
    "criticalRowCounts": {
        "project": int(os.environ["RESTORE_PROJECT_COUNT"]),
        "site": int(os.environ["RESTORE_SITE_COUNT"]),
        "reportSnapshot": int(os.environ["RESTORE_REPORT_COUNT"]),
    },
    "criticalTables": "verified",
    "applicationReadiness": "verified",
}
temporary = proof_path.with_name(proof_path.name + ".next")
temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
temporary.chmod(0o600)
temporary.replace(proof_path)
PY

echo "managed_restore_proof=ok"
echo "backup_id=$TIMEWEB_BACKUP_ID"
echo "migration_count=$MIGRATION_COUNT"
echo "public_table_count=$TABLE_COUNT"
echo "proof_file=$RESTORE_PROOF_FILE"

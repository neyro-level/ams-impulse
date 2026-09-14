#!/usr/bin/env bash
set -euo pipefail

SHA="${1:-}"
IMAGE_DIGEST="${2:-}"
MIGRATOR_IMAGE_DIGEST="${3:-}"
ARTIFACT_SHA256="${4:-}"
ROOT="${RELEASE_ROOT:-/opt/ams-platform/ams-seo-monitor}"
LOOPBACK_ORIGIN="${LIVE_PROOF_LOOPBACK_ORIGIN:-http://127.0.0.1:3000}"
PUBLIC_ORIGIN="${LIVE_PROOF_PUBLIC_ORIGIN:-https://impulse.ams24.ru}"
PRIVATE_PATH="${LIVE_PROOF_PRIVATE_PATH:-/analyst/}"
CRITICAL_PATH="${LIVE_PROOF_CRITICAL_PATH:-$PRIVATE_PATH}"
PROOF_DIR="$ROOT/shared/release-proofs"
PROOF_FILE="$PROOF_DIR/$SHA.json"

for value in SHA IMAGE_DIGEST MIGRATOR_IMAGE_DIGEST ARTIFACT_SHA256 LIVE_PROOF_EMAIL LIVE_PROOF_PASSWORD; do
  if [ -z "${!value:-}" ]; then
    echo "${value,,}_missing=true" >&2
    exit 1
  fi
done
if ! [[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || ! [[ "$ARTIFACT_SHA256" =~ ^[0-9a-f]{64}$ ]]; then
  echo "live_proof_identity_invalid=true" >&2
  exit 1
fi
if [[ "$PRIVATE_PATH" != /* ]] || [[ "$CRITICAL_PATH" != /* ]] || [[ "$PRIVATE_PATH" == /api/* ]] || [[ "$CRITICAL_PATH" == /api/* ]]; then
  echo "live_proof_read_path_invalid=true" >&2
  exit 1
fi
if [[ "$PRIVATE_PATH" == *".."* ]] || [[ "$CRITICAL_PATH" == *".."* ]]; then
  echo "live_proof_read_path_invalid=true" >&2
  exit 1
fi

COOKIE_JAR="$(mktemp)"
LIVE_JSON="$(mktemp)"
READY_JSON="$(mktemp)"
trap 'rm -f "$COOKIE_JAR" "$LIVE_JSON" "$READY_JSON"' EXIT
chmod 0600 "$COOKIE_JAR" "$LIVE_JSON" "$READY_JSON"

export COMPOSE_PROJECT_NAME=ams-seo-monitor
COMPOSE_FILE="$ROOT/current/docker-compose.production.yml"
WEB_CONTAINER_ID="$(docker compose -f "$COMPOSE_FILE" ps -q web)"
WORKER_CONTAINER_ID="$(docker compose -f "$COMPOSE_FILE" ps -q worker)"
RESEARCH_WORKER_CONTAINER_ID="$(docker compose -f "$COMPOSE_FILE" ps -q research-worker)"
[ -n "$WEB_CONTAINER_ID" ] || { echo "live_proof_web_container_missing=true" >&2; exit 1; }
[ -n "$WORKER_CONTAINER_ID" ] || { echo "live_proof_worker_container_missing=true" >&2; exit 1; }
[ -n "$RESEARCH_WORKER_CONTAINER_ID" ] || { echo "live_proof_research_worker_container_missing=true" >&2; exit 1; }
[ "$(docker inspect --format '{{.Image}}' "$WEB_CONTAINER_ID")" = "$IMAGE_DIGEST" ] || { echo "live_proof_web_digest_mismatch=true" >&2; exit 1; }
[ "$(docker inspect --format '{{.Image}}' "$WORKER_CONTAINER_ID")" = "$IMAGE_DIGEST" ] || { echo "live_proof_worker_digest_mismatch=true" >&2; exit 1; }
[ "$(docker inspect --format '{{.Image}}' "$RESEARCH_WORKER_CONTAINER_ID")" = "$IMAGE_DIGEST" ] || { echo "live_proof_research_worker_digest_mismatch=true" >&2; exit 1; }

docker exec "$WEB_CONTAINER_ID" node scripts/runtime-entrypoint.mjs verify-database-runtime
docker exec "$WORKER_CONTAINER_ID" node scripts/runtime-entrypoint.mjs verify-database-runtime

curl --fail --silent --show-error --max-time 15 "$LOOPBACK_ORIGIN/api/health/live" > "$LIVE_JSON"
READINESS_CONFIRMED=false
for _attempt in $(seq 1 30); do
  OUTBOX_HEALTH="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$WORKER_CONTAINER_ID")"
  RESEARCH_HEALTH="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$RESEARCH_WORKER_CONTAINER_ID")"
  if [ "$OUTBOX_HEALTH" = healthy ] && [ "$RESEARCH_HEALTH" = healthy ] \
    && curl --fail --silent --show-error --max-time 15 "$LOOPBACK_ORIGIN/api/health/ready" > "$READY_JSON" \
    && python3 - "$SHA" "$LIVE_JSON" "$READY_JSON" <<'PY'
import json
import sys

sha, live_path, ready_path = sys.argv[1:]
with open(live_path, encoding="utf-8") as handle:
    live = json.load(handle)
with open(ready_path, encoding="utf-8") as handle:
    ready = json.load(handle)
dependencies = ready["dependencies"]
assert live["status"] == "ok" and live["releaseSha"] == sha
assert ready["status"] == "ready" and ready["releaseSha"] == sha
assert dependencies["postgresql"] == "ready"
assert dependencies["auth"] == "configured"
assert dependencies["outbox"]["status"] == "healthy"
assert dependencies["worker"]["status"] == "healthy"
freshness = dependencies["integrationFreshness"]
assert freshness["status"] in {"fresh", "unknown"}
if freshness["status"] == "unknown":
    assert freshness["latestSyncFinishedAt"] is None
    assert freshness["latestSyncStatus"] is None
else:
    assert freshness["latestSyncFinishedAt"] is not None
    assert freshness["latestSyncStatus"] in {"success", "partial"}
PY
  then
    READINESS_CONFIRMED=true
    break
  fi
  sleep 2
done
[ "$READINESS_CONFIRMED" = true ] || { echo "live_proof_readiness_failed=true" >&2; exit 1; }

[ "$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 15 "$PUBLIC_ORIGIN/")" = "200" ] || { echo "live_proof_public_route_failed=true" >&2; exit 1; }
[ "$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 15 "$PUBLIC_ORIGIN/api/health/ready")" = "403" ] || { echo "live_proof_external_ready_exposed=true" >&2; exit 1; }

python3 - <<'PY' | curl --fail --silent --show-error --max-time 15 \
  --cookie-jar "$COOKIE_JAR" --header 'Content-Type: application/json' \
  --data-binary @- "$LOOPBACK_ORIGIN/api/auth/sign-in/email" >/dev/null
import json
import os
print(json.dumps({"email": os.environ["LIVE_PROOF_EMAIL"], "password": os.environ["LIVE_PROOF_PASSWORD"]}))
PY

for path in "$PRIVATE_PATH" "$CRITICAL_PATH"; do
  STATUS="$(curl --silent --show-error --location --cookie "$COOKIE_JAR" --output /dev/null --write-out '%{http_code}' --max-time 20 "$LOOPBACK_ORIGIN$path")"
  [ "$STATUS" = "200" ] || { echo "live_proof_private_read_failed=true" >&2; exit 1; }
done

systemctl is-active --quiet seo-monitor-web.service
for timer in seo-monitor-worker.timer seo-monitor-topvisor-checks.timer seo-monitor-competitors.timer seo-monitor-outbox.timer; do
  systemctl is-enabled --quiet "$timer"
  systemctl is-active --quiet "$timer"
done

install -d -o root -g root -m 0700 "$PROOF_DIR"
export LIVE_PROOF_SHA="$SHA"
export LIVE_PROOF_IMAGE_DIGEST="$IMAGE_DIGEST"
export LIVE_PROOF_MIGRATOR_IMAGE_DIGEST="$MIGRATOR_IMAGE_DIGEST"
export LIVE_PROOF_ARTIFACT_SHA256="$ARTIFACT_SHA256"
export LIVE_PROOF_CRITICAL_PATH_VALUE="$CRITICAL_PATH"
export LIVE_PROOF_READY_JSON="$READY_JSON"
export LIVE_PROOF_FILE="$PROOF_FILE"
python3 - <<'PY'
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

with open(os.environ["LIVE_PROOF_READY_JSON"], encoding="utf-8") as handle:
    ready = json.load(handle)
dependencies = ready["dependencies"]
proof = {
    "schemaVersion": 1,
    "kind": "production-live-proof",
    "verifiedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "deployedSha": os.environ["LIVE_PROOF_SHA"],
    "imageDigest": os.environ["LIVE_PROOF_IMAGE_DIGEST"],
    "migratorImageDigest": os.environ["LIVE_PROOF_MIGRATOR_IMAGE_DIGEST"],
    "artifactSha256": os.environ["LIVE_PROOF_ARTIFACT_SHA256"],
    "health": "verified",
    "readiness": "verified",
    "database": dependencies["postgresql"],
    "worker": dependencies["worker"]["status"],
    "researchWorker": "verified",
    "queue": {
        "status": dependencies["outbox"]["status"],
        "pending": dependencies["outbox"]["pending"],
        "processing": dependencies["outbox"]["processing"],
        "deadLetter": dependencies["outbox"]["deadLetter"],
    },
    "privateRoute": "verified",
    "criticalReadFlow": "verified",
    "criticalPathRef": hashlib.sha256(os.environ["LIVE_PROOF_CRITICAL_PATH_VALUE"].encode()).hexdigest()[:16],
    "servicesAndTimers": "verified",
    "businessMutation": "none",
}
path = Path(os.environ["LIVE_PROOF_FILE"])
temporary = path.with_name(path.name + ".next")
temporary.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
temporary.chmod(0o600)
temporary.replace(path)
PY

echo "production_live_proof=ok"
echo "deployed_sha=$SHA"
echo "release_record=$PROOF_FILE"

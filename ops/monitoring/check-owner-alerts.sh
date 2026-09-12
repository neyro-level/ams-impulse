#!/usr/bin/env bash
set -euo pipefail

ALERT_ENV_FILE="${ALERT_ENV_FILE:-/etc/ams-platform/ams-seo-monitor-alerts.env}"
STATE_ROOT="${STATE_ROOT:-/var/lib/ams-platform/ams-seo-monitor/alerts}"
DISK_WARNING_PERCENT="${DISK_WARNING_PERCENT:-85}"
TEMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEMP_ROOT"' EXIT

if [[ ! -r "$ALERT_ENV_FILE" ]]; then
  echo "alerting_configuration_missing=true" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ALERT_ENV_FILE"
set +a

python3 - "${ALERT_WEBHOOK_URL:-}" <<'PY'
import sys
from urllib.parse import urlsplit

url = urlsplit(sys.argv[1])
if url.scheme != "https" or not url.hostname or url.username or url.password or any(char in sys.argv[1] for char in '\\"\r\n'):
    raise SystemExit("alert_webhook_url_invalid=true")
PY

issues="$TEMP_ROOT/issues.txt"
: > "$issues"

if ! systemctl is-active --quiet seo-monitor-web.service; then
  echo "UPTIME_WEB_SERVICE_DOWN" >> "$issues"
fi
if ! systemctl is-active --quiet seo-monitor-worker.service; then
  echo "WORKER_SERVICE_DOWN" >> "$issues"
fi

live="$TEMP_ROOT/live.json"
ready="$TEMP_ROOT/ready.json"
if ! curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3000/api/health/live > "$live"; then
  echo "UPTIME_LIVE_CHECK_FAILED" >> "$issues"
fi
if curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3000/api/health/ready > "$ready"; then
  if ! python3 - "$ready" >> "$issues" <<'PY'
import json
import sys

payload = json.load(open(sys.argv[1], encoding="utf-8"))
dependencies = payload.get("dependencies", {})
outbox = dependencies.get("outbox", {})
worker = dependencies.get("worker", {})
if outbox.get("deadLetter", 0) > 0:
    print(f'DEAD_JOBS:{int(outbox["deadLetter"])}')
if outbox.get("status") != "healthy":
    print("QUEUE_DEGRADED")
if worker.get("status") != "healthy":
    print("WORKER_HEARTBEAT_STALE")
PY
  then
    echo "READINESS_PAYLOAD_INVALID" >> "$issues"
  fi
else
  echo "READINESS_CHECK_FAILED" >> "$issues"
fi

while IFS= read -r path; do
  usage="$(df -P "$path" | awk 'NR==2 {gsub(/%/, "", $5); print $5}')"
  if [[ "$usage" =~ ^[0-9]+$ ]] && (( usage >= DISK_WARNING_PERCENT )); then
    echo "DISK_CAPACITY:${path}:${usage}" >> "$issues"
  fi
done < <(printf '%s\n' / /var/lib/docker /var/backups | while read -r path; do [[ -e "$path" ]] && printf '%s\n' "$path"; done)

error_count="$(journalctl -u seo-monitor-web.service -u seo-monitor-worker.service --since '-10 minutes' --no-pager --output cat 2>/dev/null \
  | awk 'index($0, "\"level\":\"error\"") { count += 1 } END { print count + 0 }')"
if [[ "$error_count" =~ ^[0-9]+$ ]] && (( error_count > 0 )); then
  echo "PRODUCTION_ERRORS:${error_count}" >> "$issues"
fi

sort -u -o "$issues" "$issues"
install -d -o root -g root -m 0700 "$STATE_ROOT"
current_hash="$(sha256sum "$issues" | cut -d' ' -f1)"
previous_hash="$(cat "$STATE_ROOT/last-issues.sha256" 2>/dev/null || true)"
if [[ "$current_hash" == "$previous_hash" ]]; then
  exit 0
fi

payload="$TEMP_ROOT/payload.json"
python3 - "$issues" "$payload" <<'PY'
import datetime
import json
from pathlib import Path
import sys

issues_path, payload_path = sys.argv[1:]
issues = [line for line in Path(issues_path).read_text(encoding="utf-8").splitlines() if line]
payload = {
    "service": "ams-impulse",
    "status": "degraded" if issues else "recovered",
    "occurredAt": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
    "issues": issues,
}
Path(payload_path).write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
PY

printf 'url = "%s"\n' "$ALERT_WEBHOOK_URL" | curl --config - --fail --silent --show-error --max-time 15 \
  --request POST --header 'Content-Type: application/json' --data-binary "@$payload" >/dev/null
printf '%s\n' "$current_hash" > "$STATE_ROOT/last-issues.sha256.next"
chmod 0600 "$STATE_ROOT/last-issues.sha256.next"
mv -f "$STATE_ROOT/last-issues.sha256.next" "$STATE_ROOT/last-issues.sha256"

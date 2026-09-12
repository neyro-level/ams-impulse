import { chmod, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DEFAULT_API_ORIGIN = "https://api.timeweb.cloud";
const DEFAULT_MAX_AGE_SECONDS = 7_200;
const FUTURE_TOLERANCE_SECONDS = 300;

function required(name, env) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name.toLowerCase()}_missing=true`);
  return value;
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name.toLowerCase()}_invalid=true`);
  }
  return parsed;
}

/** @typedef {{ id: string | number, status: string, created_at: string, type?: string, createdAtMs?: number }} ManagedBackup */

/**
 * @param {ManagedBackup[]} backups
 * @param {{ now?: Date, maxAgeSeconds?: number, restorePointId?: string | number }} [options]
 * @returns {{ backup: ManagedBackup & { createdAtMs: number }, ageSeconds: number }}
 */
export function selectManagedBackup(backups, {
  now = new Date(),
  maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS,
  restorePointId,
} = {}) {
  if (!Array.isArray(backups)) throw new Error("provider_backup_response_invalid=true");

  const completed = backups
    .filter((backup) => backup && backup.status === "done" && backup.id != null)
    .map((backup) => ({ ...backup, createdAtMs: Date.parse(backup.created_at) }))
    .filter((backup) => Number.isFinite(backup.createdAtMs))
    .sort((left, right) => right.createdAtMs - left.createdAtMs);

  const selected = restorePointId == null
    ? completed[0]
    : completed.find((backup) => String(backup.id) === String(restorePointId));
  if (!selected) {
    throw new Error(restorePointId == null
      ? "provider_backup_completed_missing=true"
      : "provider_restore_point_missing=true");
  }

  const ageSeconds = Math.floor((now.getTime() - selected.createdAtMs) / 1_000);
  if (ageSeconds < -FUTURE_TOLERANCE_SECONDS) {
    throw new Error("provider_backup_timestamp_future=true");
  }
  if (ageSeconds > maxAgeSeconds) throw new Error("provider_backup_stale=true");

  return { backup: selected, ageSeconds: Math.max(ageSeconds, 0) };
}

export async function verifyManagedBackup({ env = process.env, fetchImpl = fetch, now = new Date() } = {}) {
  const token = required("TIMEWEB_CLOUD_TOKEN", env);
  const databaseId = required("TIMEWEB_DATABASE_ID", env);
  const proofFile = required("PROVIDER_BACKUP_PROOF_FILE", env);
  const maxAgeSeconds = positiveInteger(
    env.PROVIDER_BACKUP_MAX_AGE_SECONDS ?? DEFAULT_MAX_AGE_SECONDS,
    "PROVIDER_BACKUP_MAX_AGE_SECONDS",
  );
  const destructive = env.DESTRUCTIVE_MIGRATION === "true";
  const restorePointId = destructive
    ? required("TIMEWEB_RESTORE_POINT_ID", env)
    : undefined;
  const endpoint = `${DEFAULT_API_ORIGIN}/api/v1/dbs/${encodeURIComponent(databaseId)}/backups?limit=100&offset=0`;

  let response;
  try {
    response = await fetchImpl(endpoint, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("provider_backup_api_unreachable=true");
  }
  if (!response.ok) throw new Error(`provider_backup_api_status=${response.status}`);

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("provider_backup_response_invalid=true");
  }

  const { backup, ageSeconds } = selectManagedBackup(payload.backups, {
    now,
    maxAgeSeconds,
    restorePointId,
  });
  const proof = {
    schemaVersion: 1,
    provider: "timeweb-cloud",
    databaseRef: createHash("sha256").update(databaseId).digest("hex").slice(0, 16),
    backupId: String(backup.id),
    backupType: backup.type ?? "unknown",
    backupCreatedAt: new Date(backup.createdAtMs).toISOString(),
    verifiedAt: now.toISOString(),
    maxAgeSeconds,
    destructiveMigration: destructive,
  };
  const temporaryFile = `${proofFile}.next`;
  await writeFile(temporaryFile, `${JSON.stringify(proof, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporaryFile, 0o600);
  await rename(temporaryFile, proofFile);
  return { backupId: proof.backupId, ageSeconds, destructiveMigration: destructive };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  verifyManagedBackup()
    .then((result) => process.stdout.write(`${JSON.stringify({ managedBackup: "verified", ...result })}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : "provider_backup_verification_failed=true"}\n`);
      process.exitCode = 1;
    });
}

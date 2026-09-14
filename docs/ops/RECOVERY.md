# RECOVERY

Recovery has two independent contours:

1. code/runtime rollback;
2. PostgreSQL data recovery.

Code rollback does not roll back schema/data. DB restore is not an automatic release rollback.

## Runtime Rollback

Automatic post-switch rollback in `scripts/deploy-production.mjs` restores:

- previous `current` symlink;
- previous Nginx/systemd assets;
- previous `shared/release.env`;
- previous web/worker runtime.

It does not delete failed release automatically and does not change PostgreSQL data.

Manual rollback requires:

- exact current SHA;
- exact previous SHA;
- release health DTO;
- service states;
- proof that previous code is compatible with already applied schema.

## Database Recovery

Production backup contract:

- custom-format `pg_dump`;
- checksum;
- private offsite copy;
- remote HEAD confirmation before retention;
- 7 daily / 8 weekly / 6 monthly;
- credentials outside Git/logs/docs.

Restore procedure:

1. choose verified dump/checksum;
2. resolve `latest.dump` to exact immutable file;
3. mount it read-only;
4. restore into temporary PostgreSQL database;
5. verify owner, migrations and key row counts;
6. verify application compatibility;
7. request separate owner decision before production restore.

`ops/postgres/restore-smoke.sh` must never restore over production.

### Managed PostgreSQL restore drill

Run an isolated provider restore every 3–6 months and before especially destructive data work. This drill never authorizes or performs a production restore.

1. Select a completed Timeweb physical backup and record its ID.
2. Restore it through Timeweb into a new temporary PostgreSQL 18 target in the private network. The target provider ID must differ from the production source ID.
3. Start a temporary application instance against that target on loopback or an RFC1918 private address.
4. Put the identifiers, separate restore credentials, production host/name fingerprint, private application URL and `RESTORE_PROOF_FILE` in a root-owned env file.
5. Run `env -i PATH="$PATH" bash -c 'set -a; source /etc/ams-platform/ams-restore-drill.env; set +a; /opt/ams-platform/ams-seo-monitor/current/ops/postgres/managed-restore-proof.sh'`.
6. Preserve the generated `0600` JSON proof in the protected operations evidence store, then delete the temporary app and restore target.

The executable gate refuses a source/target ID match, a production host/database match and a public application URL. It proves PostgreSQL 18, completed Prisma migrations, required tables and application/database readiness. Credentials, database coordinates, row data and PII are not written to the proof.

## Platform Admin Access Recovery

Normal recovery requires one unused offline Platform Admin recovery code and the two-stage
`recover-platform-admin` / `verify-platform-admin-recovery` owner CLI flow. Passwords,
recovery codes and TOTP codes enter only through stdin. Recovery material is written to a
new `0600` file on an explicit bind mount outside the checkout, moved to offline storage and
removed from the server after verification.

A legacy administrator created before the mandatory-TOTP contract may use the separate
`adopt-legacy-platform-admin` / `verify-platform-admin-adoption` flow exactly once. The CLI
fails closed unless the target is the sole enabled Platform Admin and has no TOTP or recovery
records. The first stage rotates the password, revokes all sessions and creates pending TOTP
plus recovery codes. Platform authority remains denied until the second stage verifies TOTP.
Both stages write safe AuditEvents. Direct auth-table edits and password-only exceptions are
forbidden.

Run the compiled CLI only from the exact deployed runtime image through a manual one-shot
Compose invocation using the protected web environment. Bind a temporary owner-only host
directory to `/run/owner-material`; do not print the generated password or recovery material
and do not pass secrets in argv. After completion, prove username sign-in, TOTP challenge,
private route access, session attributes and both adoption AuditEvents.

## Failure Classes

- Web release failure: rollback code/assets only.
- Migration failure before cutover: stop; fix with new reviewed migration, never edit applied migration.
- Worker provider failure: keep honest SourceRun/ReportSnapshot state; no DB restore.
- Outbox failure: inspect PENDING/PROCESSING/DEAD_LETTER and retry only after root-cause correction.
- Data corruption/loss: stop writes, preserve evidence, verify offsite dump in temp DB, request owner decision.
- Secret compromise: follow [`TOKEN_ROTATION.md`](TOKEN_ROTATION.md).

## Required Evidence

- current and rollback SHA;
- migration state;
- health/auth/tenant smoke;
- worker status and timestamps;
- backup checksum and offsite confirmation;
- temporary restore row-count checks;
- latest managed restore proof (maximum six months; repeat immediately before especially destructive data work);
- incident timeline without secrets/PII.

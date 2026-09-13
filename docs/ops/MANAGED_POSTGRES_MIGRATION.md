# Managed PostgreSQL Migration

Status: infrastructure cutover completed on `2026-09-11`; application/RLS release completed on `2026-09-13`.

Production was moved after the explicit owner command. This document now records the active contract and rollback boundary; it is not authorization for another infrastructure change.

## Required topology

- Timeweb Managed PostgreSQL 18 in the same Moscow private network as the application server;
- no public database endpoint;
- TLS-required connection from the application server over the private BGP address;
- separate login credentials for `ams_web`, `ams_worker`, `ams_migrator` and `ams_backup`;
- credentials separated in root-owned production env files; rotated replacements must also be synchronized to the project Doppler scope through a write-capable identity.

`ams_web` and `ams_worker` are `NOBYPASSRLS` runtime roles. `ams_migrator` owns schema changes but is never used by the application. Timeweb Managed PostgreSQL does not currently allow the project administrator to grant `BYPASSRLS`; therefore provider physical backups are the complete recovery source after `FORCE RLS` is enabled. The independent logical S3 backup has a fail-closed RLS preflight and must never publish a partial dump.

With `BACKUP_STRATEGY=provider-physical`, deployment calls the Timeweb Cloud API immediately before migrations, requires a completed backup created within the previous two hours, writes a root-only proof and disables the logical backup timer. A missing token, API failure, incomplete or stale backup stops release. `TIMEWEB_CLOUD_TOKEN` and `TIMEWEB_DATABASE_ID` belong only in the protected backup env file. A destructive migration additionally requires `DESTRUCTIVE_MIGRATION=true` and an explicit `TIMEWEB_RESTORE_POINT_ID` that resolves to the completed fresh backup.

## Completed proof

1. Fresh source backup, checksum and isolated restore smoke passed.
2. Four provider-managed login identities were created and least-privilege DML/DDL checks passed.
3. Immutable production release `1c5c3d6450a6934034f10ce15d91cdfb18da7659` completed all 42 migrations and live/ready smoke against the target.
4. Final write freeze and restore completed; exact row counts matched for all 55 persistent tables.
5. Web and worker returned healthy status after the switch; PostgreSQL, auth, outbox, worker heartbeat and integration freshness were ready.
6. A post-cutover logical dump, checksum and private S3 upload passed.
7. The previous local database is read-only with zero application connections and retained through `2026-09-25`.

The product RLS authorization matrix was applied by the `2026-09-13` release after an exact-head RISKY gate. Runtime identities remain non-owner `NOBYPASSRLS`; web and project-scoped workers passed allowed/denied access proof. The release used a fresh provider-physical Timeweb backup and kept the incompatible logical backup timer disabled.

## Hard stops

- Do not grant `BYPASSRLS` or table ownership to web/worker logins.
- Runtime roles may remain active only while every protected request/job opens a transaction and sets its verified authorization context.
- Do not expose the managed database through a public IP.
- Do not treat a successful dump as recovery proof; restore and row-count checks are mandatory.

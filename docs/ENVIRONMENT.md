# ENVIRONMENT

This document is the canonical registry of AMS IMPULSE environment variable ownership. Values are never stored in Git or docs.

## Sources

- Local development: ignored `.env.local` from `.env.example`.
- Application secret source: approved Doppler/project protected env.
- Production runtime: root-owned protected env files for web, worker, migrator and backup.
- Release identity: generated root-owned `shared/release.env`.
- Tests: explicit isolated `TEST_DATABASE_*`.
- SourceCraft workflow inputs: CI-owned, not application runtime env.

One credential must not be reused between web, worker, migrator, tests and backup.

`BACKUP_STRATEGY` is `logical` only while the backup identity can produce a complete dump. Production switches it to `provider-physical` when `FORCE RLS` is active; release then verifies a completed Timeweb backup live, writes a root-only proof and keeps the incompatible logical timer disabled. The protected backup env owns `TIMEWEB_CLOUD_TOKEN`, `TIMEWEB_DATABASE_ID` and optional `PROVIDER_BACKUP_MAX_AGE_SECONDS` (default: 7200). Destructive migrations also require `DESTRUCTIVE_MIGRATION=true` and the explicit `TIMEWEB_RESTORE_POINT_ID`.

Production DB credentials currently live in root-owned server env files separated by web, worker, migrator and backup. Synchronizing their rotated replacements into the dedicated AMS IMPULSE Doppler scope remains an owner action because the current Codex service identity is read-only. Timeweb account tokens are operator credentials and never become application runtime variables.

Post-deploy proof uses a fifth root-owned file, `/etc/ams-platform/ams-seo-monitor-live-proof.env`. It owns `LIVE_PROOF_EMAIL`, `LIVE_PROOF_PASSWORD` and optional public/loopback origins plus `LIVE_PROOF_PRIVATE_PATH` and `LIVE_PROOF_CRITICAL_PATH`. The identity is a dedicated least-privilege read-only product user, never Platform Admin, and has access only to the two proof paths. Both paths are GET-only private UI reads; API paths are rejected. These credentials are release-operator secrets and never enter application containers or proof records.

## Database Variables

Application accepts either `DATABASE_URL` or a complete component set:

- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_NAME`
- `DATABASE_SSLMODE`
- `DATABASE_RUNTIME` — `web`, `worker` or `migrator`; selects bounded pool and transaction timeouts.

`APP_ENV` must identify `development`, `test` or `production`. Partial DB config fails closed. Diagnostics may print env, host, port, database and identity, but never full URL or password.

Production managed PostgreSQL uses its private BGP address and TLS. Node.js URLs use libpq-compatible `sslmode=require` because the provider endpoint presents a self-signed certificate; encryption is required but CA/hostname verification is not available in the current provider configuration. Public database endpoints are forbidden.

Prisma migration commands require explicit `DATABASE_URL`; `prisma generate` is DB-independent.

## Web/Auth Variables

- `BETTER_AUTH_SECRET` — secret, web only.
- `BETTER_AUTH_URL` — canonical public HTTPS origin.
- `RELEASE_SHA` — release identity for web/worker.
- `NEXT_PUBLIC_LEADS_API_URL` — public build-time lead endpoint origin.
- `NEXT_PUBLIC_LEADS_PROJECT_ID` — public project identifier.
- `NEXT_PUBLIC_LEADS_SITE_KEY` — public anti-abuse site identifier.
- `NODE_ENV` — runtime mode.

Changing `NEXT_PUBLIC_*` requires rebuild/redeploy. Changing runtime secret requires restart of affected process.

## Worker/Provider Variables

- `YANDEX_WEBMASTER_API_BASE_URL`
- `YANDEX_WEBMASTER_OAUTH_TOKEN`
- `YANDEX_WEBMASTER_SITE_URL`
- `YANDEX_WEBMASTER_TOKEN_STATUS`
- `YANDEX_METRICA_API_BASE_URL`
- `YANDEX_METRICA_OAUTH_TOKEN`
- `YANDEX_METRICA_SITE_URL`
- `YANDEX_METRICA_TOKEN_STATUS`
- `TOPVISOR_USER_ID`
- `TOPVISOR_API_KEY`
- `TOPVISOR_API_BASE_URL`
- `OUTBOX_WORKER_ID`
- `OUTBOX_POLL_DELAY_MS`
- `RESEARCH_WORKER_ID`
- `LOG_LEVEL`
- `PGBOSS_SCHEMA`
- `PGBOSS_RUNTIME_ROLE` — local/CI pg-boss migration target role, not a production application secret.
- `XMLRIVER_USER`
- `XMLRIVER_KEY`
- `RESEARCH_QUERY_ESTIMATE_KOPECKS` — operator-maintained aggregate allocation per logical query covering three separately billable XMLRiver operations (SERP, suggestions and Wordstat); this is a conservative budget estimate, not the provider invoice amount;
- `RESEARCH_DAILY_LIMIT_KOPECKS`
- `RESEARCH_MONTHLY_LIMIT_KOPECKS`
- `S3_BUCKET`
- `S3_ENDPOINT`
- `S3_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Provider token presence does not enable provider calls by itself. Calls require enabled ProviderConnection in PostgreSQL and valid server-side env after restart. Browser must never receive provider token variables.

XMLRiver credentials are worker-only. S3 credentials are web-only for authorized Research exports. Full provider URLs, credentials and signed download URLs must never be logged.

## MFA And MCP Controls

Platform Admin TOTP secrets and hashed recovery material live in Better Auth/PostgreSQL. Enrollment, bootstrap and recovery codes enter operator commands through stdin; they are not environment variables.

MCP scope, client-metadata cache TTL, subject rate window and request limit are code-owned constants (`MCP_SCOPE`, `MCP_CLIENT_METADATA_CACHE_TTL`, `MCP_RATE_WINDOW_MS`, `MCP_SUBJECT_REQUEST_LIMIT`). Changing them requires reviewed code and security proof; production env cannot silently weaken these controls.

## Local/Test Variables

Local:

- `LOCAL_POSTGRES_PORT`
- `LOCAL_POSTGRES_USER`
- `LOCAL_POSTGRES_PASSWORD`

Tests:

- `TEST_DATABASE_HOST`
- `TEST_DATABASE_PORT`
- `TEST_DATABASE_USER`
- `TEST_DATABASE_PASSWORD`
- `TEST_DATABASE_NAME`
- `TEST_DATABASE_SSLMODE`

Test database name must end with `_test`; test identity must be dedicated and different from local/production identity.

## Backup/Restore Variables

- `DB_NAME`
- `BACKUP_ROOT`
- `BACKUP_FILE`
- `KEEP_DAILY`
- `KEEP_WEEKLY`
- `KEEP_MONTHLY`
- `S3_BUCKET`
- `S3_ENDPOINT`
- `S3_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `REQUIRE_OFFSITE`
- `POSTGRES_IMAGE`
- `MIN_PROJECT_COUNT`
- `MIN_SITE_COUNT`
- `MIN_REPORT_COUNT`
- `BACKUP_STRATEGY`
- `TIMEWEB_CLOUD_TOKEN`
- `TIMEWEB_DATABASE_ID`
- `PROVIDER_BACKUP_PROOF_FILE`
- `PROVIDER_BACKUP_MAX_AGE_SECONDS`
- `DESTRUCTIVE_MIGRATION`
- `TIMEWEB_RESTORE_POINT_ID`
- `TIMEWEB_BACKUP_ID`
- `TIMEWEB_SOURCE_DATABASE_ID`
- `TIMEWEB_RESTORE_TARGET_ID`

Post-deploy proof owns `LIVE_PROOF_EMAIL`, `LIVE_PROOF_PASSWORD`, `LIVE_PROOF_LOOPBACK_ORIGIN`, `LIVE_PROOF_PUBLIC_ORIGIN`, `LIVE_PROOF_PRIVATE_PATH` and `LIVE_PROOF_CRITICAL_PATH`. Owner alerting owns only `ALERT_WEBHOOK_URL`.

Backup variables never enter web/worker containers. Restore smoke targets only an ephemeral database.

## Change Rule

New env variable requires:

- owner boundary in this file;
- `.env.example` update when locally relevant;
- validation update;
- runbook update if operator-facing;
- no secret value in Git/docs/logs.

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

`BACKUP_STRATEGY` is `logical` only while the backup identity can produce a complete dump. Production switches it to `provider-physical` when `FORCE RLS` is active; release then requires a root-owned provider backup proof newer than two hours and keeps the incompatible logical timer disabled.

Production DB credentials currently live in root-owned server env files separated by web, worker, migrator and backup. Synchronizing their rotated replacements into the dedicated AMS IMPULSE Doppler scope remains an owner action because the current Codex service identity is read-only. Timeweb account tokens are operator credentials and never become application runtime variables.

## Database Variables

Application accepts either `DATABASE_URL` or a complete component set:

- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_NAME`
- `DATABASE_SSLMODE`

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
- `YANDEX_WEBMASTER_TOKEN_STATUS`
- `YANDEX_METRICA_API_BASE_URL`
- `YANDEX_METRICA_OAUTH_TOKEN`
- `YANDEX_METRICA_TOKEN_STATUS`
- `TOPVISOR_USER_ID`
- `TOPVISOR_API_KEY`
- `TOPVISOR_API_BASE_URL`
- `OUTBOX_WORKER_ID`
- `OUTBOX_POLL_DELAY_MS`
- `LOG_LEVEL`
- `PGBOSS_SCHEMA`
- `XMLRIVER_USER`
- `XMLRIVER_KEY`
- `RESEARCH_QUERY_ESTIMATE_KOPECKS`
- `RESEARCH_DAILY_LIMIT_KOPECKS`
- `RESEARCH_MONTHLY_LIMIT_KOPECKS`
- `S3_BUCKET`
- `S3_ENDPOINT`
- `S3_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Provider token presence does not enable provider calls by itself. Calls require enabled ProviderConnection in PostgreSQL and valid server-side env after restart. Browser must never receive provider token variables.

XMLRiver credentials are worker-only. S3 credentials are web-only for authorized Research exports. Full provider URLs, credentials and signed download URLs must never be logged.

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

Backup variables never enter web/worker containers. Restore smoke targets only an ephemeral database.

## Change Rule

New env variable requires:

- owner boundary in this file;
- `.env.example` update when locally relevant;
- validation update;
- runbook update if operator-facing;
- no secret value in Git/docs/logs.

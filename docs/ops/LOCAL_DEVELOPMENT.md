# LOCAL DEVELOPMENT

Canonical local mode: Windows-native checkout + Windows-native PostgreSQL `18.6`.

## Environment

- OS: Windows 11.
- Database service: `postgresql-x64-18`.
- Bind: `127.0.0.1`.
- Port: `5435`.
- Development DB/role: `seo_monitor_dev` / `seo_monitor_local`.
- Test DB/role: `seo_monitor_test` / `seo_monitor_test`.
- Local env file: ignored `.env.local` based on `.env.example`.
- Docker/WSL: not used for ordinary local development.

Production credentials are forbidden locally. Owner-approved production snapshot may be used only as one-time local copy without provider secrets, with revoked sessions/verification tokens and separate local auth secret.

## First Setup

```bash
pnpm install --frozen-lockfile
pnpm playwright:install
```

Create `.env.local` and fill only local/test values:

- `APP_ENV=development`;
- development `DATABASE_*` for `seo_monitor_dev`;
- isolated `TEST_DATABASE_*` for `seo_monitor_test`;
- local-only `BETTER_AUTH_SECRET`;
- no production URLs, passwords or provider tokens unless a specific safe local provider task requires them.
- `RESEARCH_QUERY_ESTIMATE_KOPECKS`, `RESEARCH_DAILY_LIMIT_KOPECKS` and `RESEARCH_MONTHLY_LIMIT_KOPECKS` for Research pricing and budget policy;
- test-only XMLRiver/S3 values only when the corresponding integration is intentionally exercised.

Never print secrets or commit `.env.local`.

## Database Lifecycle

```bash
pnpm dev:db:start
pnpm dev:db:status
pnpm dev:db:migrate
pnpm dev:db:bootstrap
pnpm dev:db:stop
```

`dev:db:start` and `dev:db:status` verify server version, DB name and role without printing password. `dev:db:stop` does not stop the shared Windows service.

## Application

```bash
pnpm dev:status
pnpm dev:start
```

Canonical local URL: `http://127.0.0.1:3001`.

The launcher:

- verifies native PostgreSQL;
- reuses a running AMS IMPULSE process when safe;
- starts Next.js on `3001` when free;
- stops if `3001` belongs to another app;
- preserves tracked generated files from dev server churn;
- does not reset password/session on ordinary start.

Canonical local operator username: `superadmin`. Password is never written in docs, argv or logs.

## Tests

Unit tests:

```bash
pnpm test:unit
```

Integration tests:

```bash
pnpm test:integration
```

Integration runner must reject unsafe targets: DB name must end with `_test`, test identity must be dedicated and different from local/production identity, migrations are applied only to test DB, and bootstrap uses synthetic data only.

E2E:

```bash
pnpm test:e2e
```

E2E builds production-like standalone runtime and checks public UI/auth/private shell at `375 / 768 / 1280 / 1440`.

## Verification

```bash
pnpm architecture:check
pnpm verify:quick
pnpm verify:risky
pnpm verify:daily
```

Use the smallest proof that matches scope. `verify:risky` and `verify:daily` require isolated test DB; `verify:daily` also requires Playwright Chromium and Semgrep.

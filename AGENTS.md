# AMS IMPULSE — Project Router

Этот файл — первый проектный источник истины для AI. Он уточняет глобальный AMS-канон и не заменяет код, schema, migrations или runtime config.

## Project Identity

AMS IMPULSE — модульная CRM-платформа АМС: публичный сайт SEO-услуги, клиентские продукты **SEO Монитор** и **АМС Лиды**, внутренний продукт **Инструменты** и единый приватный кабинет. Чужие runtime, БД, auth и credentials не используются.

Repository slug in SourceCraft: `integrator-p/ams-impulse`.

Canonical branch: `origin/main`.

## Platform Contract

`AMS Application Platform Core 4.0 — Solo Minimal`.

```text
TENANCY = multi-tenant
ASYNC = outbox-plus-queue
DATA = pii
DELIVERY = own-saas
PLATFORM_ADMIN = enabled
DATABASE = managed-postgresql
DELIVERY_PROFILE = CRITICAL
```

Текущий production использует Timeweb Managed PostgreSQL 18 в частной сети без публичного database IP. Web, worker, migrator и backup используют отдельные provider-managed identities. Прежняя self-managed БД остаётся read-only только до завершения окна отката `2026-09-25`.

## Active Sources Of Truth

Обязательное ядро:

- `README.md` — быстрый контекст и route map.
- `docs/PRODUCT.md` — пользователи, сценарии, продуктовые ограничения.
- `docs/ARCHITECTURE.md` — stack, layers, runtime, release topology.
- `docs/DATA_MODEL.md` — data ownership, schema policy, lifecycle, invariants.
- `docs/SECURITY.md` — identity, authorization, tenancy, RLS, PII, secrets, trust boundaries.
- `docs/MASTER_PLAN.md` — только незавершённая работа.
- `docs/RUNBOOK_DEPLOY.md` — production release and recovery gate.

Профильные документы:

- `docs/modules/MODULE_*.md` — contracts значимых bounded modules.
- `docs/INTERNAL_DASHBOARD_DESIGN_SYSTEM.md` — private application UI.
- `docs/EXTERNAL_SITE_DESIGN_SYSTEM.md` — public marketing/legal UI.
- `docs/PLATFORM_CONFORMANCE.md` — guarantee-to-proof matrix for merge and release gates.
- `docs/ops/*.md` — конкретные operator runbooks.
- `docs/adr/*` — труднообратимые решения.

Архив `docs/archive/**` не является каноном. Читать его только для истории normalization или явного archaeology task.

## Runtime Truth

- exact package versions: `package.json`, `pnpm-lock.yaml`, `.node-version`;
- database truth: `prisma/schema.prisma`, `prisma/migrations/*`;
- executable boundaries: `dependency-cruiser.config.cjs`, `scripts/verify-architecture.mjs`;
- release truth: `Dockerfile`, `docker-compose.production.yml`, `ops/**`, `scripts/deploy-production.mjs`;
- local run truth: `docs/ops/LOCAL_DEVELOPMENT.md`.

Docs explain intent; code/schema/config decide actual behavior.

## Product Invariants

- products: `seo-monitor`, `leads`, `tools`;
- SEO hierarchy: `SEO Organization -> SEO Project -> Site -> Report`;
- Leads hierarchy: `Leads Organization -> Leads Project -> Funnel -> Lead`;
- Tools hierarchy: `Tools Organization -> Tools Project -> Tool-owned records`;
- Tools modules: `research`, `contracts`, `invoices`, `presentations`, `site-clone`;
- product organization/project registries never substitute for each other;
- organization membership alone does not grant project access;
- URL/data contract: `clientSlug/siteSlug` and `/c/*`;
- `SiteReportSnapshot` is the only browser-safe report DTO;
- periods: `week`, `month`, `quarter`, `halfYear`; default `month`;
- `partial != success`, `stale != current`, `null != 0`;
- Webmaster average show position is not exact ranking;
- Top-3 is a subset of Top-10;
- ranking denominator is the full approved enabled query core;
- direct query-to-lead attribution is prohibited;
- PostgreSQL is the only runtime source of truth;
- operator config import is explicit private-path work, never deploy side effect.

## Security And Data Rules

1. Browser, URL, form, hidden input and navigation never prove tenant access.
2. Server-generated identity-only `PrincipalContext` plus fresh product grants are the only authorization inputs.
3. Better Auth owns identity/password/session; AMS owns product memberships, project grants, permissions and resource authorization.
4. Platform Admin has no fake tenant and must name target organization for cross-tenant actions.
5. Every tenant-owned record stores product-local `organizationId` and `projectId`; composite PostgreSQL constraints protect parent ownership.
6. Default is deny. Except `PLATFORM_ADMIN`, no system role implicitly opens a product or project.
7. Navigation hiding is presentation only; route/query/command/worker/MCP authorization is mandatory.
8. Prisma is allowed only in approved database/infrastructure boundaries.
9. Business mutation path: `defineAction/API/job adapter -> defineCommand -> transaction-bound repository`.
10. External HTTP/email/provider/storage calls are forbidden inside business transaction.
11. Applied migrations are immutable; production `db push` is forbidden.
12. Secrets/PII must not appear in Git, docs, browser, argv, logs, AuditEvent or raw error bodies.
13. Provider credentials exist only server-side. Yandex providers are read-only; paid writes use explicit budget confirmation and idempotency.
14. Production uses exact reviewed SHA and immutable image; merge is not release.

## Architecture Map

- `src/app` — route composition only.
- `src/components` — shared public/private UI.
- `src/modules/identity-access` — users, product memberships, project grants and access administration.
- `src/modules/product-catalog` — product/tool registry and browser-safe labels.
- `src/modules/project-registry` — SEO organizations, projects, sites and configuration until renamed behind its facade.
- `src/modules/tools-workspace` — Tools organizations/projects and their grants.
- `src/modules/research` — Research domain, execution, export and MCP facade.
- `src/modules/reporting` — report reads and `SiteReportSnapshot` compiler.
- `src/modules/ranking-analytics` — pure ranking semantics.
- `src/modules/data-ingestion` — provider orchestration, normalized evidence, worker APIs.
- `src/modules/notifications` — browser-safe lifecycle notifications.
- `src/modules/platform-operations` — audit, idempotency, outbox, pg-boss, JobRun, readiness, retention.
- `src/modules/platform-admin` — protected admin composition.
- `src/platform` — neutral auth/authorization/database/actions/commands/config/http/MCP/observability.
- `collector/sources` — server-only provider adapters.
- `src/modules/*/worker.ts` и `collector/main.ts` — worker entrypoints.
- `prisma` — schema and immutable migrations.
- `ops`, `scripts` — reviewed local/release/maintenance tooling.

Cross-module consumers use root entrypoints only. New module requires `docs/modules/MODULE_<NAME>.md` before or with implementation.

## UI Routes

UX scope:

- public `/`, legal pages and login/lead modals → `PUBLIC_COMMERCIAL`, `docs/EXTERNAL_SITE_DESIGN_SYSTEM.md`;
- private `/dashboard`, `/analyst`, `/admin`, `/notifications`, `/c/*`, `/tools/*` → `APPLICATION_WORKSPACE`, `docs/INTERNAL_DASHBOARD_DESIGN_SYSTEM.md`;
- no CMS-native admin exists.

Private UI uses PT Root UI, semantic tokens and project-owned shadcn/Base UI primitives. Public UI uses isolated `theme-public`, Manrope and `ch-*` tokens. Do not mix token systems.

## Work Modes

Use SourceCraft as primary.

```text
WORK: branch/worktree from origin/main → scoped edits → optional checkpoint
PR: create PR only, no implicit tests/review/CI
MERGE: review + STANDARD/RISKY exact-head gate → merge → cleanup
RELEASE: owner command only → deploy runbook
```

Do not work directly on `main` for a new independent stream.

## Risk Classification

`STANDARD`:

- docs-only normalization;
- public/private presentation with no data/auth/runtime change;
- safe read/client UI work.

`RISKY`:

- schema/migrations/data retention;
- auth, tenant access, PII, secrets;
- provider integrations, Topvisor paid operations, worker/outbox;
- dependencies, Docker, CI, release, production ops.

If uncertain, classify as `RISKY`.

## Checks

Available scripts:

```bash
pnpm verify:quick
pnpm verify:risky
pnpm verify:daily
pnpm verify:release
```

Run only the minimum proof required by scope during WORK. Merge Gate and production proof are separate lifecycle commands.

## Documentation Rule

Update the authoritative document for the changed area:

- product behavior → `PRODUCT.md`;
- architecture/profile/stack/boundaries → `ARCHITECTURE.md`;
- schema/data lifecycle/invariants → `DATA_MODEL.md`;
- auth/tenancy/PII/secrets/trust → `SECURITY.md`;
- active backlog → `MASTER_PLAN.md`;
- production release/recovery → `RUNBOOK_DEPLOY.md`;
- local/operator procedure → `docs/ops/*`;
- significant module → `docs/modules/MODULE_*.md`;
- UI system → the relevant design-system document.

Do not create worklogs, audit reports, second plans, duplicate tech-stack/auth/database documents or new ADRs for small changes. Completed work is kept by Git/SourceCraft history; remove completed items from `MASTER_PLAN.md`.

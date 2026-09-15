# ARCHITECTURE

Platform contract: `AMS Application Platform Core 4.0 - Solo Minimal`.

Profile: `TENANCY = multi-tenant`, `ASYNC = outbox-plus-queue`, `DATA = pii`, `DELIVERY = own-saas`, `PLATFORM_ADMIN = enabled`, `DATABASE = managed-postgresql`, `DELIVERY_PROFILE = CRITICAL`.

`DELIVERY_PROFILE = CRITICAL` выбран владельцем перед merge/release: проект использует real-user authentication, PII, multi-tenancy, ценную постоянную PostgreSQL и production integrations. Перед каждым merge обязателен один exact-head SourceCraft Gate выбранного класса риска; release выполняется только из clean canonical `main`.

## Status Convention

- `IMPLEMENTED` - реализовано в canonical `main`.
- `DEPLOYED` - наличие в production подтверждено release record + live proof точного SHA.
- `PLANNED` - утверждено, но business runtime ещё не реализован.

SEO Монитор, модульное ядро, Инструменты и Исследования относятся к `IMPLEMENTED` и `DEPLOYED`. Аудитории, Разбор сайтов, АМС Лиды и остальные внутренние инструменты относятся к `PLANNED`. Точный production SHA, digest образа и число миграций принадлежат root-only release proof и live health response; они намеренно не зашиваются в этот документ, потому что следующий документационный commit сразу сделал бы такое значение устаревшим.

## System Context

```text
Browser / Codex / ChatGPT
-> Nginx / Next.js web
-> Better Auth identity
-> PrincipalContext
-> AuthorizationService
-> product application command/query
-> scoped repository transaction
-> PostgreSQL 18

Outbox -> pg-boss -> bounded product worker -> provider/storage -> PostgreSQL
```

Web, MCP и worker собираются из одного repository и immutable OCI image. Research worker является отдельным process/service, но не отдельным микросервисом.

Каноническая product/repository identity — `ams-impulse`. Исторический runtime-slug `ams-seo-monitor` намеренно сохранён для существующих server paths, OCI tags, Compose project, systemd/Nginx assets и health DTO. Его переименование является отдельной production migration, а не частью обычной нормализации документов.

## Actual Stack

Exact versions определяют `package.json`, `pnpm-lock.yaml` и `.node-version`:

| Layer | Current implementation |
| --- | --- |
| Runtime | Node.js `24.20.0`, pnpm `11.5.1` |
| Web | Next.js `16.3.3`, React `19.2.8`, TypeScript strict `6.0.3` |
| Identity | Better Auth `1.7.2`; the required account-schema transition before any newer patch is defined by `ADR-004-better-auth-account-schema-transition.md` |
| Data | Prisma `7.10.0` for `public`; typed parameterized SQL repositories for `tools` and `research` |
| Database | Timeweb Managed PostgreSQL `18`, private network + TLS |
| Queue | transactional outbox + pg-boss `12.30.0` |
| Delivery | immutable OCI runtime/migrator images, Docker Compose, host Nginx/systemd |

Version-sensitive changes require exact installed-version evidence; this document does not override the lockfile.

## Module Map

| Boundary | Responsibility | Runtime entrypoints |
| --- | --- | --- |
| `identity-access` | Better Auth principal, product membership and project grants | `index.ts`, `server.ts`, `worker.ts` |
| `product-catalog` | browser-safe product/tool codes and availability | `index.ts` |
| `project-registry` | SEO organizations, projects, sites and configuration | `index.ts`, `server.ts`, `worker.ts` |
| `data-ingestion` | provider orchestration and normalized evidence | `index.ts`, `server.ts`, `worker.ts` |
| `ranking-analytics` | pure ranking semantics | `index.ts` |
| `reporting` | `SiteReportSnapshot`, director analytics and report reads | `index.ts`, `server.ts`, `worker.ts` |
| `tools-workspace` | Tools organizations, projects and grants | `index.ts`, `server.ts` |
| `research` | Research lifecycle, XMLRiver execution, exports and MCP | `index.ts`, `server.ts`, `worker.ts` |
| `audience-intelligence` (`PLANNED/BLOCKED`) | Separate discovery and profile/content enrichment ports, evidence and XLSX; discovery provider is not selected | planned `index.ts`, `server.ts`, `worker.ts` |
| `site-intelligence` (`PLANNED`) | bounded collection, normalization and comparison of public sites | planned `index.ts`, `server.ts`, `worker.ts` |
| `notifications` | browser-safe lifecycle notifications | `index.ts`, `server.ts`, `actions.ts` |
| `platform-operations` | audit, idempotency, outbox, queue, readiness and retention | `index.ts`, `server.ts`, `worker.ts` |
| `platform-admin` | protected composition of module-owned admin workflows | `index.ts`, `server.ts` |

`src/app` composes routes only; `src/platform` owns neutral technical contracts. Cross-module consumers use public entrypoints, not another module's infrastructure files.

## Product Boundaries

### Platform

Владеет identity adapters, product catalog, authorization contract, commands/actions, database scope, audit, idempotency, outbox, queue transport, HTTP/MCP transport and observability.

Optimistic-concurrency errors remain domain-specific inside modules, but every transport normalizes them to `STALE_STATE` with a safe message, `correlationId` and optional `latestVersion`.
Actions, HTTP/API and MCP share one failure envelope: `{ ok: false, error: { code, message, fieldErrors, correlationId, latestVersion? } }`. Transport responses never serialize raw exceptions, SQL/provider messages or stack traces.
Every platform command emits one PII-free `command_finished` event with command name, duration, outcome, safe code on failure, correlation ID and principal kind.

### SEO Monitor

Владеет SEO organizations/projects/sites, provider configuration/evidence, ranking analytics and reports. Текущие `project-registry`, `data-ingestion`, `ranking-analytics` and `reporting` остаются совместимыми facades во время миграции.

### AMS Leads

Владеет Leads organizations/projects/funnels/leads. На первом цикле регистрируется как недоступный product; business implementation выполняется позже.

### Tools

Владеет Tools organizations/projects and project grants. Подмодули используют `ToolsProject` через публичный facade:

- `research`;
- `audience-intelligence` (`PLANNED`);
- `site-intelligence` — запланирован как «Разбор сайтов» по [`modules/MODULE_SITE_INTELLIGENCE.md`](modules/MODULE_SITE_INTELLIGENCE.md);
- `contracts`;
- `invoices`;
- `presentations`;
- `site-clone`.

Research, будущие Audience Intelligence и Site Intelligence не создают собственные organizations/projects.

## Layer Rules

Модуль может содержать `domain / application / infrastructure / presentation`.

- Domain не импортирует Next.js, React, Prisma, HTTP, MCP или provider SDK.
- Application зависит от domain и typed ports.
- Infrastructure реализует repositories/providers/storage.
- Presentation вызывает только module facade.
- `index.ts` публикует browser-safe contracts, pure domain values and types; server runtime composition принадлежит `server.ts`, worker composition — `worker.ts`.
- Route и worker entrypoints получают готовые services из module-owned composition roots; глобального service locator нет.
- Cross-module consumers используют только публичные module entrypoints (`index.ts`, `contracts.ts`, `presentation.ts`, `actions.ts`, `server.ts`, `worker.ts`); MCP composition публикуется через `research/server.ts`.
- Deep imports другого module, app-to-infrastructure, client-to-server, Prisma in domain/presentation, raw unsafe SQL, raw revalidation и mutation server actions вне `defineAction` запрещает architecture guard.

## Product Catalog

Neutral registry предоставляет browser-safe metadata:

```text
seo-monitor -> SEO Монитор -> active
leads       -> АМС Лиды    -> planned
tools       -> Инструменты  -> active when user has grant
```

Tools registry:

```text
research      -> Исследования
audience-intelligence -> Аудитории (planned; discovery gate required)
contracts     -> Договоры
invoices      -> Счета
presentations -> Презентации
site-clone    -> Клон сайтов
```

Feature availability and access are separate: active module still requires permission.

## Identity And Authorization

Principal/session resolution is memoized with `React.cache` only inside the current React Server Component render. Layouts and pages may reuse that one fresh resolution. Server Actions, Route Handlers and workers do not rely on this render cache and perform fresh reads; no process-global identity cache exists, so disable/session revocation is observed no later than the next request.

Project grant reads use the same render-scoped mechanism, keyed by Prisma client, user and product. Repeated authorization during one server render reuses grants; calls outside a Server Component render bypass React memoization and read PostgreSQL. Access revocation therefore cannot outlive a request, and worker/job authorization never shares browser render state.

`PrincipalContext` carries identity, system role and correlation ID. It does not select an arbitrary first organization.

Application commands convert that server-owned principal into a discriminated database authorization context. The transaction installs transaction-local `ams.*` values as its first SQL operation and only then invokes the command repository. Missing job/project scope is a fail-closed error; client input is never a context source.

Tenant repositories receive the command transaction and explicit organization/project scope directly. There is no parallel `ScopedDb` security abstraction: authorization, transaction-local context, scoped predicates, RLS and composite constraints form the enforceable layered contract.

Platform Admin mutation adapters never acquire a global Prisma client or open a nested transaction. Their composition roots inject the contextual command transaction explicitly; read-only query adapters receive the global client explicitly in a separate query path.

```text
authorize(principal, permission, resourceRef)
-> system-role check
-> product membership
-> explicit project grant
-> module-owned resource relation
-> ALLOW | DENY
```

The only implicit global access is `PLATFORM_ADMIN`. `ANALYST` and `CLIENT` require explicit grants. Navigation is built from `listAccessibleProducts`, but every backend entrypoint authorizes independently.

Product-specific membership/project-access tables preserve real foreign keys. Generic polymorphic `resourceType/resourceId` grants are prohibited.

## Data Schemas

Current PostgreSQL layout:

- `public` - existing Better Auth identity, SEO data, audit, outbox and runtime records;
- `platform` - active RLS context helpers and platform boundary;
- `tools` - Tools organizations, projects and grants;
- `research` - Research records and exports;
- `audience` - reserved for planned Audience Intelligence records, evidence, provider operations and exports;
- `pgboss` - active queue transport objects owned by pg-boss;
- `seo`, `leads`, `contracts`, `invoices`, `presentations`, `site_clone`, `ops` - reserved schemas for incremental extraction of the corresponding domains.

The Prisma schema owns the existing `public` models. Immutable SQL migrations and typed repository adapters own the cross-schema Tools/Research tables. A reserved schema is not evidence that its product is implemented, and product schemas do not imply separate database servers.

## RLS Defense

Tenant-owned tables use PostgreSQL Row-Level Security after compatibility proof:

- `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`;
- runtime roles are `NOBYPASSRLS` and do not own protected tables;
- web reads/writes use transaction-local principal/product/project context;
- missing or malformed context means deny;
- worker context names exact product/organization/project;
- migrator owns DDL; backup procedure explicitly verifies complete dump/restore.

RLS is defense in depth. Application authorization and composite ownership constraints remain mandatory.

## Research Runtime

```text
UI / MCP
-> Research command
-> transaction: Research + Run + Audit + Outbox
-> outbox worker
-> research.run.v1
-> research worker (concurrency 1)
-> XMLRiver / export storage
-> normalized evidence + competitor projection
```

Paid call runs only after a persisted estimate, matching confirmed amount, idempotency reservation and active permission. Ambiguous provider outcome becomes `FAILED` with a safe code and is not retried automatically.

Canonical release topology runs `research-worker` as a separate long-lived Compose service with
the dedicated worker managed-database identity and server-only provider environment. The process keeps
one pg-boss runtime, consumes one job at a time and closes queue/database resources
on `SIGTERM`/`SIGINT`. Its database role has DML only; schema and queue migrations
remain the one-shot migrator's responsibility.

Research queue timing has one code-owned policy: 5-second polling, 60-second
heartbeat writes, 3-minute stale heartbeat, 15-minute job expiry and 20-minute
stale-run recovery. Queue retry count and retry delay are both zero because an
ambiguous paid provider effect must never be repeated automatically.

After an ungraceful restart, the worker obtains only stale tenant/project scopes
through a narrow `SECURITY DEFINER` function restricted to `ams_worker`. It then
re-enters normal job-scoped RLS context and marks interrupted runs and active query
steps `FAILED / WORKER_INTERRUPTED_AMBIGUOUS`. The original queue item has no
automatic retry, so recovery never repeats a possibly completed paid call.

## MCP

Canonical endpoint: `/mcp`, Streamable HTTP. OAuth 2.1 + PKCE maps token subject to Better Auth user. Token scopes can narrow but never expand current AMS grants. MCP exposes bounded Research tools and no SQL/database/provider credentials.

## UI

Private shell uses server-built navigation and accessible organization/project options. Client state owns only presentation interactions such as drawer state. Direct URL access always reauthorizes server-side.

Private Research routes deployed in the current production baseline:

- `/tools/research/`;
- `/tools/research/[researchId]/`.

PWA uses `app/manifest.ts`, 192/512 PNG icons and a service worker with an explicit static-only allowlist. Private route/API/MCP responses use `no-store`.

## Cache Strategy

- Private application, tenant data, PII, auth, API, MCP, reports and exports are dynamic and `private, no-store` by default.
- Principal and grant memoization is React server-render-scoped computation reuse, not a cross-request response or ACL cache; actions, route handlers and workers do not depend on it.
- Public legal/marketing pages and browser-safe static assets may use framework/static caching when their data has no user or tenant scope.
- OAuth discovery is a public protocol document and may use its explicit short TTL.
- `cacheComponents` remains off; enabling it requires a separate version-verified architecture decision and private-route proof.
- `updateTag`/tagged read models are introduced only with a real shared read model, explicit invalidation owner and stale-data acceptance contract. Current mutations use path revalidation.
- A process singleton, module `Map`, Redis entry or CDN response must never cache authorization decisions, sessions, presigned URLs or private DTOs.

## Runtime And Delivery

Canonical release topology: host Nginx -> web/outbox/research worker containers -> Timeweb Managed PostgreSQL 18 over private network/TLS. The database has no public IP. Existing AMS server public IP remains because it serves HTTPS domains and SSH. Each persistent worker keeps one process, one Prisma pool and one pg-boss runtime across polling cycles; shutdown drains through the shared abort signal and closes queue resources once. The exact topology currently deployed is never inferred from `main`; release and live-proof records must identify its SHA and image digest.

Health is runtime-specific: web uses `/api/health/live`; persistent workers prove
a fresh database heartbeat for their exact runtime/worker identity. Migrator and
maintenance are one-shot services and have Docker healthchecks disabled.

All production services drop Linux capabilities, prohibit privilege escalation,
use a read-only root filesystem, bounded tmpfs, process/memory limits and rotated
local logs. Web receives a dedicated writable Next.js cache tmpfs; workers and
one-shot jobs receive only `/tmp`. Persistent services restart automatically,
while migrator and maintenance never restart as daemons.

Database sessions use explicit runtime profiles. Web statements/transactions are
bounded to 15/10 seconds with a 3-second lock wait; workers use 60-second
statement/transaction limits and a 5-second lock wait; migrator allows up to 15
minutes but waits at most 10 seconds for a lock. Every profile sets
`application_name`, a 5-second connection timeout and an idle-in-transaction
timeout. Prisma interactive transactions inherit profile-specific `maxWait` and
`timeout`. Compose задаёт web/worker только `TimeZone=UTC`: timeout-параметры
принадлежат `pool-config.ts` и не дублируются в `PGOPTIONS`. Release proof
подключается из фактических web/worker containers и fail-closed сверяет
`application_name`, `TimeZone`, `statement_timeout`, `lock_timeout` и
`idle_in_transaction_session_timeout`; migration CLI получает отдельный
расширенный `PGOPTIONS`.

The OCI build has separate dependency boundaries: build dependencies compile the
application, production dependencies feed the web/worker runtime, and a distinct
one-shot migrator target contains Prisma migration tooling. Web and workers never
receive TypeScript, ESLint, Playwright, dependency-cruiser or other dev-only packages.

The runtime filesystem contains only Next.js standalone output (including public
and static assets), compiled collector/worker code, production dependencies and a
small runtime entrypoint. Source TypeScript, Prisma schema/tooling, tsconfig,
framework build configuration, Compose and build scripts are absent. The separate
migrator contains only its database schema/configuration and migration entrypoint.

Web, worker, migrator and backup use separate provider-managed identities. The previous self-managed database is read-only through `2026-09-25`; deletion requires a separate owner decision. Research worker входит в каноническую release topology и выполняет только project-scoped jobs.

Текущий production release применяет полную цепочку immutable migrations. Web, outbox worker и Research worker требуют exact-image health/live proof; точный SHA, digest образа, число применённых миграций и recovery point записываются в root-only release proof, а не в этот версионируемый архитектурный документ. Pre-migration recovery использует свежий Timeweb provider-physical backup, поэтому несовместимый logical-backup timer отключён. Для пустого набора настроенных sync-проектов `integrationFreshness = unknown` допустим только когда оба поля sync history равны `null`; `stale` всегда блокирует release.

## Verification

ESLint uses TypeScript Project Service for production roots `src` and
`collector`. `no-floating-promises` is strict. `no-misused-promises` is strict
outside JSX event attributes; React form/click attributes retain their framework
void-return boundary so enabling typed lint does not rewrite UI lifecycle merely
to satisfy a callback type. Inline rule disables and known-safe Promise allowlists
are not part of this contract.

SourceCraft does not start verification merely because a PR was created. Merge evidence is started manually against the reviewed exact head SHA:

- `standard-check` runs `verify:quick` plus an explicit allowlisted set of relevant unit tests;
- `risky-check` runs `verify:quick`, explicit relevant unit and PostgreSQL integration tests,
  and adds Semgrep and/or a production build only when the classified risk requires them;
- `release-check` remains the full exact-head release proof for canonical `main`.

`daily` is also manual. Branch pushes, PR creation and schedules do not start development verification; the owner starts DAILY proof only at the real daily/release boundary.

The test file inputs are data, not shell fragments: the scoped runner accepts only existing
`tests/*.test.ts` paths and invokes Node processes without a shell.

- `pnpm architecture:check` - dependency/import boundaries.
- `pnpm test:unit` - domain and contracts.
- `pnpm test:integration` - PostgreSQL authorization/constraints/RLS.
- `pnpm test:e2e` - browser access matrix and responsive flows.
- `pnpm verify:risky` - changed auth/data/runtime proof.
- SourceCraft exact-head RISKY gate before merge.

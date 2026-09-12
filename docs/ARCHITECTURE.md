# ARCHITECTURE

Platform contract: `AMS Application Platform Core 3.4 - Solo Minimal`.

Profile: `TENANCY = multi-tenant`, `ASYNC = outbox-plus-queue`, `DATA = pii`, `DELIVERY = own-saas`, `PLATFORM_ADMIN = enabled`, `DATABASE = managed-postgresql-target`.

## Status Convention

- `CURRENT` - работает в canonical `main` и production.
- `PLANNED` - утверждено, но ещё не реализовано или не выпущено.

SEO Монитор, модульное ядро, Инструменты и Исследования относятся к `CURRENT`. АМС Лиды и остальные внутренние инструменты относятся к `PLANNED`.

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
- `contracts`;
- `invoices`;
- `presentations`;
- `site-clone`.

Research не создаёт собственные organizations/projects.

## Layer Rules

Модуль может содержать `domain / application / infrastructure / presentation`.

- Domain не импортирует Next.js, React, Prisma, HTTP, MCP или provider SDK.
- Application зависит от domain и typed ports.
- Infrastructure реализует repositories/providers/storage.
- Presentation вызывает только module facade.
- Cross-module consumers используют root entrypoints `index.ts`, `server.ts`, `worker.ts`; MCP adapter находится в `research/mcp/`.
- Deep imports другого module запрещает architecture guard.

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
contracts     -> Договоры
invoices      -> Счета
presentations -> Презентации
site-clone    -> Клон сайтов
```

Feature availability and access are separate: active module still requires permission.

## Identity And Authorization

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
- `platform` - RLS context helpers and reserved platform boundary;
- `tools` - Tools organizations, projects and grants;
- `research` - Research records and exports;
- `seo`, `leads`, `contracts`, `invoices`, `presentations`, `site_clone`, `ops`, `pgboss` - reserved schemas for incremental extraction of the corresponding domains.

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

## MCP

Canonical endpoint: `/mcp`, Streamable HTTP. OAuth 2.1 + PKCE maps token subject to Better Auth user. Token scopes can narrow but never expand current AMS grants. MCP exposes bounded Research tools and no SQL/database/provider credentials.

## UI

Private shell uses server-built navigation and accessible organization/project options. Client state owns only presentation interactions such as drawer state. Direct URL access always reauthorizes server-side.

Research routes в production:

- `/tools/research/`;
- `/tools/research/[researchId]/`.

PWA uses `app/manifest.ts`, 192/512 PNG icons and a service worker with an explicit static-only allowlist. Private route/API/MCP responses use `no-store`.

## Runtime And Delivery

Current production: host Nginx -> web/outbox worker containers -> Timeweb Managed PostgreSQL 18 over private network/TLS. The database has no public IP. Existing AMS server public IP remains because it serves HTTPS domains and SSH.

Web, worker, migrator and backup use separate provider-managed identities. The previous self-managed database is read-only through `2026-09-25`; deletion requires a separate owner decision. Research worker входит в текущую production topology и выполняет только project-scoped jobs.

## Verification

- `pnpm architecture:check` - dependency/import boundaries.
- `pnpm test:unit` - domain and contracts.
- `pnpm test:integration` - PostgreSQL authorization/constraints/RLS.
- `pnpm test:e2e` - browser access matrix and responsive flows.
- `pnpm verify:risky` - changed auth/data/runtime proof.
- SourceCraft exact-head RISKY gate before merge.

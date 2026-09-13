# PLATFORM CONFORMANCE

Core Standard version: `AMS Application Platform Core 4.0 — Solo Minimal`

Conformance reviewed: `2026-09-13`
Reviewed scope: current project code, database, CI and release contracts. Production remains separately proven only for baseline `1c5c3d6450a6934034f10ce15d91cdfb18da7659`.

## Project Profile

```text
TENANCY = multi-tenant
ASYNC = outbox-plus-queue
DATA = pii
DELIVERY = own-saas
PLATFORM_ADMIN = enabled
DATABASE = managed-postgresql
DELIVERY_PROFILE = CRITICAL
```

Допустимые состояния: `IMPLEMENTED`, `PARTIAL`, `NOT_IMPLEMENTED`, `NOT_APPLICABLE`, `EXCEPTION`.

## Current Conformance

| Guarantee | State | Current evidence / gap |
|---|---|---|
| Node.js runtime | IMPLEMENTED | `.node-version` и `package.json` фиксируют Node.js `24.20.0`. |
| Next.js | IMPLEMENTED | `package.json` фиксирует Next.js `16.3.3`, App Router находится в `src/app`. |
| React | IMPLEMENTED | `package.json` фиксирует React `19.2.8`. |
| TypeScript | IMPLEMENTED | Strict TypeScript `6.0.3` является текущей проверенной project version line; Core 4.0 намеренно не фиксирует долгоживущую minor/patch линию. |
| Prisma | IMPLEMENTED | Prisma Client и CLI `7.10.0`, PostgreSQL adapter и `prisma.config.ts` присутствуют; migrations являются фактической историей schema. |
| PostgreSQL | IMPLEMENTED | Production target — Timeweb Managed PostgreSQL 18 в private network; runtime, migrator и backup identities разделены по проектному канону. |
| Better Auth | IMPLEMENTED | Better Auth `1.7.2` владеет identity/password/session; public signup отключён. |
| Authorization | IMPLEMENTED | Typed product grants, deny-by-default checks and exact `organizationId/projectId` ResourceRef scope are enforced at action/query/MCP/worker boundaries. |
| Multi-tenancy | IMPLEMENTED | Product-local memberships/grants, server-owned selection, audit/outbox scope and composite ownership constraints are implemented. |
| PostgreSQL RLS | IMPLEMENTED | `defineCommand` installs transaction-local principal/job context before repository work; runtime roles are non-owner `NOBYPASSRLS`, missing context denies. |
| Async / outbox / queue | IMPLEMENTED | Outbox and pg-boss have long-lived outbox and Research workers in canonical Compose topology, bounded shutdown and no ambiguous paid retry. |
| SourceCraft CI | IMPLEMENTED | Branch push, PR creation и schedule не запускают verification; manual exact-head `standard-check`, `risky-check`, `daily` и `release-check` определены в `.sourcecraft/ci.yaml`. |
| Risk classification | IMPLEMENTED | `pnpm risk:classify` сопоставляет exact Git diff с high-risk paths и выдаёт только повышающий внимание `RISK_HINT`; semantic review остаётся обязательным. |
| Main branch protection | IMPLEMENTED | `.sourcecraft/branches.yaml` запрещает force push, direct non-PR changes и удаление default branch. Review и exact-head gate остаются обязательным AMS process gate. |
| Docker release | IMPLEMENTED | Separate runtime/migrator targets use production dependencies; final images omit npm/corepack, include the reviewed OS security update, and the release build blocks fixable critical/high image CVEs through Docker Scout. The migrator probe rejects development-only tooling. Non-root and read-only service hardening is explicit. |
| Backup | IMPLEMENTED | Release selects logical or provider-physical strategy and requires offsite/restore or fresh Timeweb backup evidence before migration. |
| Restore proof | IMPLEMENTED | Isolated logical restore smoke and managed PostgreSQL restore-drill tooling produce protected evidence; periodic execution remains an operations task. |
| Platform Admin MFA | IMPLEMENTED | Verified TOTP is mandatory for Platform Admin authority; bootstrap and one-time hashed recovery material have explicit operator flows and tests. |
| MCP | IMPLEMENTED | OAuth 2.1 + PKCE, bounded CIMD, disabled unauthenticated DCR, same-origin browser policy, per-subject rate limiting and 12 Research tools are implemented. |
| PWA private cache safety | IMPLEMENTED | Service worker intercepts only immutable static paths, deletes old versions and respects response cache prohibitions; logout/offline browser proof exists. Android/iOS install QA remains operational. |
| Production live proof | IMPLEMENTED | Owner-authorized release `1c5c3d6` completed on `2026-09-13`: exact SHA/digests, web/outbox/research-worker health, queue/timers, private read paths, 42 migrations and fresh Timeweb backup were recorded in the root-only proof. |

## Interpretation

Матрица описывает реализованный contract. Production rollout отдельно подтверждён только для baseline `1c5c3d6`; более новый docs-only `main` не меняет runtime и не считается новым release.

## Guarantee → Proof Matrix

| Guarantee | Required proof | Executable evidence | State |
|---|---|---|---|
| Tenant isolation | PostgreSQL integration | `tests/tenant-ownership.integration.test.ts`, `tests/tenant-constraints.integration.test.ts`, `tests/research-isolation.integration.test.ts` | IMPLEMENTED |
| Project isolation inside one organization | PostgreSQL integration across query, mutation, MCP and download | `tests/research-isolation.integration.test.ts` | IMPLEMENTED |
| RLS missing-context deny | PostgreSQL integration under real runtime roles | `tests/principal.integration.test.ts`, `tests/research-rls.integration.test.ts` | IMPLEMENTED |
| Platform Admin MFA | PostgreSQL integration + recovery contract | `tests/principal.integration.test.ts`, `tests/platform-admin-recovery.test.ts`, auth E2E | IMPLEMENTED |
| Research budget concurrency | PostgreSQL integration with parallel transactions | `tests/research-concurrency.integration.test.ts` | IMPLEMENTED |
| Command idempotency | Unit + PostgreSQL integration | `tests/reliability.integration.test.ts`, `tests/research-concurrency.integration.test.ts` | IMPLEMENTED |
| Outbox atomicity | PostgreSQL integration | `tests/reliability.integration.test.ts` | IMPLEMENTED |
| Paid retry safety | Unit + PostgreSQL integration | `tests/research-execution.test.ts`, `tests/research-worker-policy.test.ts`, `tests/research-concurrency.integration.test.ts` | IMPLEMENTED |
| MCP grants cannot expand AMS access | PostgreSQL integration through MCP application boundary | `tests/research-mcp.test.ts`, `tests/research-isolation.integration.test.ts` | IMPLEMENTED |
| Private responses excluded from caches | Unit + browser E2E | `tests/pwa-service-worker.test.ts`, `tests/private-cache-policy.test.ts`, `tests/e2e/platform-shell.spec.ts` | IMPLEMENTED |
| Backup completeness and isolated restore | Release/operations proof | `ops/postgres/managed-restore-proof.sh`, `scripts/verify-managed-backup.mjs` | IMPLEMENTED |

## Proof Rules

- Security, tenant, RLS, money and database guarantees require `risky-check` against the reviewed exact head SHA; local output is supporting evidence only.
- Database proofs use PostgreSQL 18 and dedicated runtime-compatible test roles. A test database name, identity or host that does not satisfy the destructive-target guard fails before migrations or seed data run.
- Unit tests may prove pure policy and retry classification, but cannot substitute for database isolation, constraints, locking or RLS.
- E2E proves the browser-visible journey and cache boundary; it does not substitute for direct command, MCP or repository tests.
- Backup/restore evidence belongs to the release gate for the exact release artifact and managed database target.

STANDARD and RISKY merge proofs, plus release proof, are manual exact-head workflows. PR creation does not trigger verification. The Merge Gate records the selected tests and result for the reviewed SHA; a new commit invalidates earlier evidence.

## Active Decisions And Exceptions

| Topic | Classification | Project decision / required resolution |
|---|---|---|
| TypeScript `6.0.3` | PROJECT DECISION | Exact version сохранена как проверенная project line по version policy Core 4.0. Следующий TypeScript major потребует отдельной RISKY-задачи. |
| SQL-owned `tools` / `research` schemas | PROJECT DECISION | PostgreSQL migrations и typed infrastructure repositories являются явными owners этих schemas. Prisma multi-schema не включается автоматически. |
| Historical CUID identifiers | COMPATIBILITY DECISION | Существующие opaque IDs сохраняются без массовой миграции. Политика только для новых domain IDs определяется отдельно и не переписывает historical records. |
| Historical runtime slug | COMPATIBILITY DECISION | Product/package/repository use `ams-impulse`; existing server paths, image/Compose/systemd names and health DTO keep technical slug `ams-seo-monitor` until a separately approved production migration. |
| Research money | CONFORMING DECISION | Денежные значения хранятся целыми копейками; текущий Research contract использует RUB и не объявляет multi-currency. Float для денег запрещён. |
| Compose host networking | EXCEPTION | Host networking preserves the Timeweb private PostgreSQL route and loopback Nginx contract without published container ports. Bridge migration requires separate staging connectivity and rollback proof. |
| Framework CSP inline bootstrap | EXCEPTION | Public and private routes have CSP and security headers, but Next framework scripts/styles retain the documented `unsafe-inline` baseline. Nonce migration requires report-only measurement and acceptance of dynamic rendering instead of static/PPR output. |

## TypeScript 6 Project Line

Решение: сохранить strict TypeScript `6.0.x`; exact version проекта определяется `package.json` и lockfile, сейчас `6.0.3`.

Проверено `2026-09-12`:

- официальные [TypeScript 6.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html) описывают переходный major и совместимость API с TypeScript 5.9 при наличии отдельных breaking changes/deprecations;
- официальный [Next.js 16 upgrade contract](https://nextjs.org/docs/app/guides/upgrading/version-16) требует TypeScript не ниже `5.1.0`;
- официальные [Prisma system requirements](https://docs.prisma.io/docs/orm/reference/system-requirements) требуют TypeScript не ниже `5.4` и Node.js линии, включающей Node 24;
- installed package contracts не задают несовместимого upper bound для Next.js `16.3.3`, React `19.2.8`, Prisma `7.10.0`, ESLint `9.39.5`, Vitest `4.1.11` и Playwright `1.62.1`;
- `typecheck`, ESLint, the full unit suite, Playwright test discovery and Next.js production build are exercised by the project gates with TypeScript `6.0.3`.

Exact runtime evidence подтверждён SourceCraft gates и production release на закреплённом Node `24.20.0` image. Локальный shell не является заменой этому exact-head proof.

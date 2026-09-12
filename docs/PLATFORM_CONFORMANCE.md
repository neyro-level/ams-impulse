# PLATFORM CONFORMANCE

Core Standard version: `AMS Application Platform Core 3.4 — Solo Minimal`

Conformance reviewed: `2026-09-12`
Reviewed commit: `9e82f2578bd4c3584c18fb4832c037c89b512974`

## Project Profile

```text
TENANCY = multi-tenant
ASYNC = outbox-plus-queue
DATA = pii
DELIVERY = own-saas
PLATFORM_ADMIN = enabled
DATABASE = managed-postgresql
```

Допустимые состояния: `IMPLEMENTED`, `PARTIAL`, `NOT_IMPLEMENTED`, `NOT_APPLICABLE`, `EXCEPTION`.

## Current Conformance

| Guarantee | State | Current evidence / gap |
|---|---|---|
| Node.js runtime | IMPLEMENTED | `.node-version` и `package.json` фиксируют Node.js `24.20.0`. |
| Next.js | IMPLEMENTED | `package.json` фиксирует Next.js `16.3.3`, App Router находится в `src/app`. |
| React | IMPLEMENTED | `package.json` фиксирует React `19.2.8`. |
| TypeScript | EXCEPTION | Strict TypeScript `6.0.3` является проверенной project version line вместо baseline `5.9.x` Core 3.4; downgrade не требуется. |
| Prisma | IMPLEMENTED | Prisma Client и CLI `7.10.0`, PostgreSQL adapter и `prisma.config.ts` присутствуют; migrations являются фактической историей schema. |
| PostgreSQL | IMPLEMENTED | Production target — Timeweb Managed PostgreSQL 18 в private network; runtime, migrator и backup identities разделены по проектному канону. |
| Better Auth | IMPLEMENTED | Better Auth `1.7.2` владеет identity/password/session; public signup отключён. |
| Authorization | PARTIAL | Typed product grants и deny-by-default service существуют, но полный `organizationId/projectId` scope пока не обязателен во всех проверках. |
| Multi-tenancy | PARTIAL | Product-local memberships/grants и composite ownership реализованы, но Research audit/outbox scope и server-owned Research selection требуют исправления. |
| PostgreSQL RLS | PARTIAL | Product/Research policies и context helpers существуют; общий `defineCommand` пока не устанавливает transaction-local authorization context. |
| Async / outbox / queue | PARTIAL | Outbox и pg-boss реализованы, но отдельный persistent Research worker отсутствует в production Compose. |
| SourceCraft CI | IMPLEMENTED | PR creation не запускает verification; manual exact-head `standard-check`, `risky-check`, `daily` и `release-check` определены в `.sourcecraft/ci.yaml`. |
| Risk classification | IMPLEMENTED | `pnpm risk:classify` сопоставляет exact Git diff с high-risk paths и выдаёт только повышающий внимание `RISK_HINT`; semantic review остаётся обязательным. |
| Main branch protection | IMPLEMENTED | `.sourcecraft/branches.yaml` запрещает force push, direct non-PR changes и удаление default branch без обязательного self-approval rule. |
| Docker release | PARTIAL | Multi-stage image и non-root runtime есть, но production layer содержит full `node_modules`, source tree и build/dev files. |
| Backup | PARTIAL | Managed backup и logical/offsite procedures описаны; автоматический provider backup freshness proof перед migration не завершён. |
| Restore proof | PARTIAL | Restore smoke tooling существует, но воспроизводимый periodic Managed PostgreSQL restore proof ещё не является закрытым contract. |
| Platform Admin MFA | NOT_IMPLEMENTED | Second factor отсутствует; прежнее ADR-исключение противоречит целевому Core 3.4 contract и подлежит удалению после внедрения TOTP/recovery. |
| MCP | PARTIAL | OAuth 2.1 + PKCE и scoped Research tools реализованы; unauthenticated dynamic client registration пока не ограничена policy/rate/cleanup contract. |
| PWA private cache safety | PARTIAL | Service worker использует static-only allowlist и version cleanup; logout/offline/device proof остаётся незавершённым. |
| Production live proof | PARTIAL | Runbook перечисляет smoke checks, но единый автоматизированный exact-SHA/digest/web/worker/queue proof отсутствует. |

## Interpretation

Матрица описывает текущее состояние reviewed commit, а не обещанное целевое состояние. `PARTIAL` и `NOT_IMPLEMENTED` закрываются только фактическим кодом, migration/configuration и соответствующим executable proof; текст аудита сам по себе не повышает статус.

## Active Decisions And Exceptions

| Topic | Classification | Project decision / required resolution |
|---|---|---|
| TypeScript `6.0.3` | EXCEPTION | Exact version сохранена как явная проверенная project line без downgrade. Следующий TypeScript major потребует отдельной RISKY-задачи. |
| SQL-owned `tools` / `research` schemas | PROJECT DECISION | PostgreSQL migrations и typed infrastructure repositories остаются единственными owners этих schemas до отдельного решения EPIC-06. Prisma multi-schema не включается автоматически. |
| Historical CUID identifiers | COMPATIBILITY DECISION | Существующие opaque IDs сохраняются без массовой миграции. Политика только для новых domain IDs определяется отдельно и не переписывает historical records. |
| Project/runtime naming | DRIFT | Product и canonical repository называются `ams-impulse`; historical runtime paths всё ещё используют `ams-seo-monitor`. До EPIC-19 это документированный drift, а не вторая identity продукта. |
| Research money | CONFORMING DECISION | Денежные значения хранятся целыми копейками; текущий Research contract использует RUB и не объявляет multi-currency. Float для денег запрещён. |
| Platform Admin without MFA | NONCONFORMANCE | Это временно незакрытый security gap, а не постоянное исключение. Целевое состояние — verified TOTP и безопасный recovery contract. |

## TypeScript 6 Project Line

Решение: сохранить strict TypeScript `6.0.x`; exact version проекта определяется `package.json` и lockfile, сейчас `6.0.3`.

Проверено `2026-09-12`:

- официальные [TypeScript 6.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html) описывают переходный major и совместимость API с TypeScript 5.9 при наличии отдельных breaking changes/deprecations;
- официальный [Next.js 16 upgrade contract](https://nextjs.org/docs/app/guides/upgrading/version-16) требует TypeScript не ниже `5.1.0`;
- официальные [Prisma system requirements](https://docs.prisma.io/docs/orm/reference/system-requirements) требуют TypeScript не ниже `5.4` и Node.js линии, включающей Node 24;
- installed package contracts не задают несовместимого upper bound для Next.js `16.3.3`, React `19.2.8`, Prisma `7.10.0`, ESLint `9.39.5`, Vitest `4.1.11` и Playwright `1.62.1`;
- `typecheck`, ESLint, `174` unit tests, Playwright test discovery и Next.js production build прошли локально с TypeScript `6.0.3`.

Локальный shell использовал Node ниже project floor `24.20.0`, поэтому exact runtime evidence должен быть повторно подтверждён SourceCraft workflow на зафиксированном Node image перед merge. Docker Desktop автоматически не запускался.

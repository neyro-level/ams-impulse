# AMS IMPULSE

AMS IMPULSE - модульная CRM-платформа АМС: публичный SEO-сайт, клиентский **SEO Монитор**, внутренние **Инструменты** и общий приватный кабинет.

Каноническая identity продукта, package и SourceCraft repository — `ams-impulse` / `integrator-p/ams-impulse`. Исторический production-slug `ams-seo-monitor` сохраняется только для совместимости существующих путей, image tags, Compose/systemd и health DTO; это техническое имя runtime, а не второе название продукта.

Первый источник истины для работы с repository: [`AGENTS.md`](AGENTS.md).

## Текущий Статус

- `main`: модульное ядро, SEO Монитор, строгие назначения, RLS, Инструменты, Исследования, XMLRiver worker, OAuth/MCP, кабинет и PWA. Production feature set определяется только deployed SHA и live proof, а не содержимым `main`.
- Production baseline: exact SHA `1c5c3d6450a6934034f10ce15d91cdfb18da7659` выпущен `2026-09-13`; web, outbox worker и Research worker прошли live proof, все 42 migrations применены. Последующие docs-only commits в `main` не меняют этот runtime baseline.
- OAuth-подключение AMS IMPULSE к Codex проверено на основном Windows-компьютере; проверка ещё на двух компьютерах остаётся операционной задачей.
- АМС Лиды, Разбор сайтов, Договоры, Счета, Презентации и Клон сайтов пока не реализованы.
- Production работает на Timeweb Managed PostgreSQL 18 в частной сети без публичного database IP; прежняя локальная БД сохранена read-only до `2026-09-25`.

## Платформа

```text
AMS Application Platform Core 4.0 - Solo Minimal
TENANCY = multi-tenant
ASYNC = outbox-plus-queue
DATA = pii
DELIVERY = own-saas
PLATFORM_ADMIN = enabled
```

Фактический стек: Node.js `24.20.x`, pnpm `11.5.1`, Next.js `16.3.3`, React `19.2.8`, TypeScript `6.0.3`, Prisma `7.10.0`, Better Auth `1.7.2`, PostgreSQL `18.x`.

## Продукты

- **SEO Монитор**: отдельные SEO-организации, проекты, сайты и отчёты.
- **АМС Лиды**: запланированный отдельный клиентский продукт.
- **Инструменты**: общий внутренний справочник `ToolsOrganization -> ToolsProject`; активный модуль - **Исследования**.

Запланированные инструменты: Разбор сайтов, Договоры, Счета, Презентации, Клон сайтов.

## Доступ

Better Auth устанавливает личность и сессию. `AuthorizationService` проверяет продукт, организацию, проект, роль и действие. Кроме `PLATFORM_ADMIN`, системная роль не открывает данные автоматически.

```text
User -> Product membership -> Explicit project grant -> Permission -> Resource
```

Меню отражает назначения, но не заменяет серверную проверку. Чужой или недоступный ресурс возвращается как not-found.

## Реализованные Входы

- SEO: `/dashboard/`, `/analyst/`, `/c/*`, `/admin/*`, `/notifications/`.
- Исследования: `/tools/research/`, `/tools/research/[researchId]/`.
- MCP: `/mcp`, OAuth 2.1 + PKCE, scope `mcp:research`.
- PWA: `/manifest.webmanifest`, проверенная установка в Windows Chromium; Android/iOS device proof остаётся в `MASTER_PLAN`.

Service worker кэширует только `/_next/static/*` и точные PWA/favicon paths без query/auth/cookie. Приватные страницы, API, MCP, OAuth, отчёты и команды не кэшируются.

## Канон

- [`docs/PRODUCT.md`](docs/PRODUCT.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)
- [`docs/PLATFORM_CONFORMANCE.md`](docs/PLATFORM_CONFORMANCE.md)
- [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md)
- [`docs/PRIVATE_APPLICATION_SCREEN_BRIEFS.md`](docs/PRIVATE_APPLICATION_SCREEN_BRIEFS.md)
- [`docs/modules/MODULE_RESEARCH.md`](docs/modules/MODULE_RESEARCH.md)
- [`docs/modules/MODULE_SITE_INTELLIGENCE.md`](docs/modules/MODULE_SITE_INTELLIGENCE.md)
- [`docs/modules/MODULE_PRODUCT_CATALOG.md`](docs/modules/MODULE_PRODUCT_CATALOG.md)
- [`docs/modules/MODULE_TOOLS_WORKSPACE.md`](docs/modules/MODULE_TOOLS_WORKSPACE.md)
- [`docs/RUNBOOK_DEPLOY.md`](docs/RUNBOOK_DEPLOY.md)

`docs/archive/` хранит только историю и не является источником истины.

## Локальная Работа

Канон: [`docs/ops/LOCAL_DEVELOPMENT.md`](docs/ops/LOCAL_DEVELOPMENT.md).

```bash
pnpm install --frozen-lockfile
pnpm dev:status
pnpm dev:start
```

Канонический URL: `http://127.0.0.1:3001`.

## Проверки

```bash
pnpm verify:quick
pnpm test:unit
pnpm test:integration
pnpm build
```

Auth, tenancy, migrations, RLS, MCP и paid provider flow относятся к `RISKY`. Локальный PASS не заменяет зелёный SourceCraft exact-head gate.

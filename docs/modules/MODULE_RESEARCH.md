# Module: Research

- Статус кода: `RELEASED`
- Production: `ACTIVE`
- Продукт: **Инструменты**
- Маршрут: `/tools/research/`
- Очередь: `research.run.v1`

## Назначение

«Исследования» хранит поисковые исследования по общему `ToolsProject`, выполняет подтверждённые платные запросы XMLRiver, строит карту конкурентов и создаёт приватный CSV. Кабинет и MCP используют один application service и один `AuthorizationService`.

## Владение Данными

```text
ToolsOrganization -> ToolsProject -> Research -> Query -> Run
Run -> QueryRun -> Evidence / CompetitorProjection / Export
```

Research не создаёт собственные организации и проекты. Все связи содержат `organizationId/projectId` и защищены составными внешними ключами и RLS.

## Реализованный MVP

- create/list/update/archive исследования;
- 1-20 запросов;
- локальная оценка стоимости и отдельное подтверждение;
- дневной лимит 500 ₽ и месячный 3000 ₽;
- pg-boss queue и worker concurrency `1`;
- XMLRiver: Yandex organic, ads, related/suggestions и Wordstat;
- bounded XML parser без DTD/external entities;
- provider failures classified as `PRE_REQUEST_RETRYABLE | DEFINITELY_NOT_CHARGED | AMBIGUOUS_AFTER_DISPATCH | NON_RETRYABLE`; finite retry разрешён только при доказанном отсутствии списания, а неоднозначный результат завершает run с `PROVIDER_RESULT_AMBIGUOUS` без retry;
- pricing and daily/monthly budget limits are mandatory server configuration (`RESEARCH_QUERY_ESTIMATE_KOPECKS`, `RESEARCH_DAILY_LIMIT_KOPECKS`, `RESEARCH_MONTHLY_LIMIT_KOPECKS`); missing or invalid pricing fails closed with `RESEARCH_PRICING_UNAVAILABLE`;
- estimate reservation acquires the organization budget lock and performs expiry, idempotency lookup, committed-spend read, limit checks and insert in one transaction;
- ambiguous timeout не повторяет платный вызов;
- история запусков, Evidence и CompetitorProjection;
- private S3 CSV и signed URL на 60 секунд;
- кабинет и шесть MCP tools.

Не реализованы: partial run, cancellation UI, XLSX, AI insights, отдельные research templates и уведомления Research.

## Состояния

- Research: `DRAFT | READY | RUNNING | SUCCEEDED | FAILED | ARCHIVED`.
- Run: `DRAFT | AWAITING_CONFIRMATION | QUEUED | RUNNING | SUCCEEDED | FAILED | CANCELLED`.
- QueryRun: `PENDING | RUNNING | SUCCEEDED | FAILED`. Terminal `Run` failure closes every remaining `PENDING`/`RUNNING` query as `FAILED`; unexecuted queries keep `costKopecks = null`, while `Run.actualCostKopecks` sums only recorded query costs.

При неоднозначном результате provider call запуск завершается `FAILED` с безопасным кодом; автоматического повтора нет. Зависший `RUNNING` старше 20 минут восстанавливается только внутри scope текущего job.

## Права

- `VIEWER`: чтение проекта и export завершённого результата.
- `OPERATOR`: чтение, создание, изменение, estimate, run, export.
- `ANALYST`: те же действия внутри явно назначенного проекта.
- `PLATFORM_ADMIN`: global access.
- без Tools grant: deny.

Server Component, server action, MCP и export повторно проверяют полный `organizationId/projectId/researchId`. Чужой ресурс возвращает not-found semantics.

Cabinet повторный клик не создаёт новый estimate/export: server выводит versioned SHA-256 key из канонического Research/Run input. MCP может передать собственный idempotency key; repository принимает повтор только при полном совпадении material input, иначе возвращает `RESEARCH_IDEMPOTENCY_CONFLICT`.

## MCP

Endpoint `/mcp`, Streamable HTTP, OAuth 2.1 + PKCE, scope `mcp:research`:

- `research_create_draft`;
- `research_estimate_run`;
- `research_confirm_and_run`;
- `research_get_run`;
- `research_create_export`;
- `research_get_export_download`.

MCP не предоставляет SQL, provider credentials или admin bearer token. Каждый вызов использует свежие AMS grants.

## Кабинет

- `/tools/research/` - разрешённые организация/проект, список и inline-создание.
- `/tools/research/[researchId]/` - редактирование, estimate/confirm, история, archive и CSV.

Селекторы строятся сервером только из выданных Tools projects. Подмена query string или hidden fields повторно блокируется на сервере.

## Хранилище И Секреты

Нормализованные данные находятся в PostgreSQL. CSV хранится в private S3 с SSE AES-256 и `no-store`; signed URL живёт 60 секунд. `XMLRIVER_USER`, `XMLRIVER_KEY`, AWS credentials и signed URL не логируются.

## Проверенное Состояние

- PostgreSQL migrations, RLS integration и tenant-isolation suite проходят release gate;
- один проект не читает соседний проект, а missing user/job context получает deny;
- OAuth 2.1 + PKCE вход из Codex проверен на основном Windows-компьютере;
- MCP публикует только шесть ограниченных Research tools;
- web и worker проходят production health check на exact release SHA;
- платный XMLRiver-вызов без подтверждения стоимости не выполнялся.

Проверка OAuth ещё на двух локальных компьютерах, PWA на реальных устройствах и полный CSV/S3 сценарий остаются в `MASTER_PLAN.md`.

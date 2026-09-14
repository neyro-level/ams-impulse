# MASTER PLAN

Документ содержит только незавершённую работу. Реализованные изменения сохраняются в Git и SourceCraft.

## Audit Remediation 2026-09

Программа основана на независимом аудите tree `9e1958ac` и повторной проверке по canonical `main`. Каждый task выполняется отдельной веткой и PR. Порядок ниже учитывает зависимости; P0-потоки не объединяются.

### Epic AR-1 — Достоверные security guards

1. **AR-01 / P0 / RISKY — Semgrep secret guard.** Исправить regex поиска hardcoded credentials, доказать каждое локальное правило positive/negative fixtures и затем проверить текущий source scope.

### Epic AR-2 — Явная авторизация и минимальные полномочия

1. **AR-02 / P0 / RISKY — ANALYST isolation.** Убрать implicit `*:any` у `identity-user`, сохранить global scope только у server-generated principals, проверить resource authorization всех потребителей и закрыть production-пользователей явными grants до merge.
2. **AR-03 / P0 / RISKY — JobPrincipal contract.** Сделать `projectId` обязательным для project-scoped job, убрать ложный principal из org-scoped orchestration и доказать project isolation worker-команд.
3. **AR-04 / P1 / RISKY — Tools VIEWER permissions.** Убрать создающий S3-объект `research:export` у read-only роли и обновить permission matrix.

### Epic AR-3 — Безопасный платный Research lifecycle

1. **AR-05 / P0 / RISKY — Estimate retry.** Разрешить новый estimate после истечения предыдущего без обхода advisory lock и без повторного списания при повторном confirm.
2. **AR-06 / P2 / STANDARD — XMLRiver credential leakage guard.** Доказать на всех ошибочных ветках клиента, что `user`, `key` и полный provider URL не входят в error/log serialization.

### Epic AR-4 — Auth и database perimeter

1. **AR-07 / P1 / RISKY — Shared auth rate limit.** Перевести Better Auth rate-limit storage в PostgreSQL, добавить требуемую library-owned таблицу новой миграцией и строгие правила для sign-in, password, 2FA и OAuth token endpoints.
2. **AR-08 / P1 / RISKY — Notification RLS.** Разделить org-level и project-level visibility без тихо невидимых строк; чужой tenant остаётся недоступен.
3. **AR-09 / P1 / RISKY — RLS coverage guard.** Механически проверять `ENABLE` + `FORCE`, authorization policies и явный registry platform-owned operational tables на живой test DB; включить proof в daily verification.

### Epic AR-5 — Воспроизводимость и безопасная эволюция

1. **AR-10 / P2 / RISKY — Better Auth post-1.7.2 transition plan.** Зафиксировать проверенный по официальному upstream план очистки отменённой `Account.issuer` схемы и отдельный rollback; packages пока не обновлять.
2. **AR-11 / P2 / STANDARD — Exact dependency pins.** Зафиксировать `pino` на lockfile version и запретить range-specifiers во всех dependency sections.
3. **AR-12 / P2 / STANDARD — Canonical dev port.** Привести прямой `pnpm dev` к уже действующему контракту launcher/docs `127.0.0.1:3001`.

## Внешние Проверки

- выполнить первый подтверждённый платный тестовый запуск Research через MCP после серверной оценки и явного подтверждения стоимости;
- проверить историю запуска, карту конкурентов и короткоживущую приватную CSV-ссылку на отдельном тестовом Tools project;
- проверить восстановление Research job после контролируемого перезапуска выпущенного worker без повторения неоднозначного paid call;
- подтвердить OAuth/MCP ещё на двух локальных компьютерах;
- проверить установку и private-cache поведение PWA на реальных Android и iOS устройствах; Windows Chromium proof выполнен;
- проверить responsive кабинет с реальными test data на `375`, `768`, `1280`, `1440`; synthetic visual baseline уже проходит CI.

## Следующие Продуктовые Эпики

1. **Audience Intelligence** — сначала выполнить блокирующий Epic 0 по [`modules/MODULE_AUDIENCE_INTELLIGENCE.md`](modules/MODULE_AUDIENCE_INTELLIGENCE.md) и получить решение владельца `GO_DISCOVERY | GO_LIST_ENRICHMENT | STOP`. Bright Data не искать Instagram-аудиторию: он рассматривается только для обогащения известных URL/username и их контента. Остальные эпики запускать только после gate; REST и новые платформы не входят в v0.1.
2. Разбор сайтов — выполнить Epics `SI-01..SI-08` по [`modules/MODULE_SITE_INTELLIGENCE.md`](modules/MODULE_SITE_INTELLIGENCE.md); proxy/managed fallback остаётся отдельным post-MVP `LATER-SI-09`.
3. Договоры.
4. Счета.
5. Презентации.
6. Клон сайтов.
7. АМС Лиды.
8. Внутренний AI-агент поверх Research application contract.

Каждый пункт - отдельная ветка, PR, review и risk-based gate.

## Операционные Задачи

- до `2026-09-25` проверить стабильность managed PostgreSQL и только отдельным решением удалить прежнюю read-only БД;
- после ротации Timeweb API token сохранить новый операторский токен в AMS IMPULSE Doppler через identity с write-доступом;
- синхронизировать ротированные DB credentials в AMS IMPULSE Doppler, не меняя раздельные runtime identities;
- завершить безопасное подключение существующих SEO provider mappings;
- подтвердить SourceCraft secret scanning;
- выполнить отдельный full-history secrets/PII scan уже публичного GitHub mirror; current-tree проверки не заменяют history proof;
- добавить внешний monitor без публикации readiness body.

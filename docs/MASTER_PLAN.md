# MASTER PLAN

Документ содержит только незавершённую работу. Реализованные изменения сохраняются в Git и SourceCraft.

## NOW — Независимый Аудит Репозитория

Цель программы `AUDIT-2026-09`: закрыть подтверждённые замечания независимого аудита без изменения продуктового scope, основного stack и действующих auth/tenant контрактов. Каждый эпик выполняется отдельной веткой и PR. Проект имеет `DELIVERY_PROFILE = CRITICAL`, поэтому все кодовые эпики проходят один `RISKY` exact-head SourceCraft Gate перед merge. Итоговый production release выполняется один раз после завершения всей программы.

### EPIC-AUD-01 — Production Database Runtime Contract

- Status: `READY`
- Priority: `P0`
- Wave: `runtime-release`

Goal: гарантировать, что web и worker соединения получают timeout-профиль только из `pool-config.ts`, а production session подтверждает фактические значения.

Tasks:

- `AUD-01.1` — убрать дублирующие timeout-параметры из `PGOPTIONS` web/outbox/research/maintenance, сохранив `TimeZone=UTC`; migrator profile оставить отдельным;
- `AUD-01.2` — добавить fail-closed runtime verifier фактических `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout`, `TimeZone` и `application_name` для web/worker identities;
- `AUD-01.3` — включить verifier в release proof и обновить release-contract tests/Architecture.

Done when:

- Compose не может переопределить web/worker pool timeout;
- тест проверяет production topology;
- PostgreSQL proof читает реальные session settings под runtime-compatible identities;
- rollback не требует schema/data rollback.

### EPIC-AUD-02 — Executable Guard Coverage

- Status: `BACKLOG`
- Priority: `P1`
- Wave: `foundation`
- Depends on: `EPIC-AUD-01`

Goal: распространить механические архитектурные и risk guards на все заявленные server/runtime boundaries.

Tasks:

- `AUD-02.1` — сканировать `src` и `collector` в `verify-architecture.mjs`;
- `AUD-02.2` — добавить regression fixtures для запрещённых конструкций в `collector`;
- `AUD-02.3` — считать RISKY изменения `collector`, MCP/HTTP boundary, module workers, `.env.example`, Semgrep и verify/CI/runtime scripts;
- `AUD-02.4` — расширить unit matrix risk classifier без превращения отсутствия match в safety verdict.

Done when: `verify:quick` механически покрывает оба code roots, а `risk:classify` поднимает внимание на каждый RISKY path из project contract.

### EPIC-AUD-03 — Browser Security Header Proof

- Status: `BACKLOG`
- Priority: `P1`
- Wave: `security-data`
- Depends on: `EPIC-AUD-02`

Goal: доказать route-aware CSP поведением Next config и сузить неиспользуемые browser capabilities.

Tasks:

- `AUD-03.1` — проверить фактические headers для `/`, `/dashboard` и `/sw.js` через официальный Next config test utility;
- `AUD-03.2` — гарантировать единственный CSP и правильный `connect-src` для public/private routes;
- `AUD-03.3` — запретить неиспользуемые `payment`, `usb` и `interest-cohort` в `Permissions-Policy`;
- `AUD-03.4` — сохранить nonce-CSP как отдельный revisit gate: report-only measurement плюс явное принятие fully dynamic rendering.

Done when: regression test проверяет итоговые response headers, а текущий documented framework-inline exception не расширяется.

### EPIC-AUD-04 — Platform Schema Privilege Hardening

- Status: `BACKLOG`
- Priority: `P1`
- Wave: `security-data`
- Depends on: `EPIC-AUD-02`

Goal: удалить у PostgreSQL pseudo-role `PUBLIC` доступ к schema `platform`, сохранив только явные runtime grants.

Tasks:

- `AUD-04.1` — добавить новую immutable migration с `REVOKE USAGE ON SCHEMA platform FROM PUBLIC`;
- `AUD-04.2` — синхронизировать managed-role provisioning и fail-closed verification;
- `AUD-04.3` — доказать grants для `ams_web`/`ams_worker` и deny для `PUBLIC`/неразрешённых helper-functions на clean и upgrade database.

Done when: production-compatible migration не меняет данные, runtime scenarios проходят, а implicit schema access отсутствует.

### EPIC-AUD-05 — Research Money Arithmetic Boundary

- Status: `BACKLOG`
- Priority: `P2`
- Wave: `research-domain`
- Depends on: `EPIC-AUD-02`

Goal: сделать pricing policy самостоятельно fail-closed при небезопасном query count или переполнении safe integer.

Tasks:

- `AUD-05.1` — валидировать query count и результат умножения внутри `ConfiguredResearchPricing`;
- `AUD-05.2` — добавить boundary tests для отрицательных, дробных и overflow значений;
- `AUD-05.3` — сохранить существующую application-level проверку как defense in depth.

Done when: pricing port не может вернуть небезопасную денежную сумму даже при ошибочном будущем caller.

### EPIC-AUD-06 — Type-aware Async Lint

- Status: `BACKLOG`
- Priority: `P2`
- Wave: `quality`
- Depends on: `EPIC-AUD-02`

Goal: добавить type-aware проверки promises без suppressions и без неограниченного lint scope.

Tasks:

- `AUD-06.1` — измерить `no-floating-promises` и `no-misused-promises` на production TypeScript roots;
- `AUD-06.2` — включить правила с project service только если fixes остаются локальными и не меняют lifecycle;
- `AUD-06.3` — исправить подтверждённые promise defects и добавить lint regression proof;
- `AUD-06.4` — при широком несовместимом diff оставить эпик `BLOCKED` с точным количеством/классами нарушений, не добавляя suppressions.

Done when: правила включены и lint проходит либо evidence доказывает отдельную migration-программу; ложный статус PASS запрещён.

### EPIC-AUD-07 — Program Closure And Release

- Status: `BACKLOG`
- Priority: `P1`
- Wave: `final-docs`
- Depends on: `EPIC-AUD-01..06`

Goal: синхронизировать канон, выполнить итоговый release proof и выпустить один immutable artifact из clean canonical `main`.

Tasks:

- `AUD-07.1` — удалить завершённые пункты программы из `MASTER_PLAN` и обновить Architecture/Security/Data/Conformance только по фактическому diff;
- `AUD-07.2` — выполнить один итоговый exact-main release workflow с переиспользованием Merge Gate evidence;
- `AUD-07.3` — провести staging smoke, promote того же digest в production и проверить health, runtime DB profiles, private access и workers;
- `AUD-07.4` — сохранить rollback/recovery evidence и обновить production baseline.

Done when: SourceCraft exact-SHA chain, artifact digest, migration state и live proof подтверждены; неизвестная production identity или отсутствие CI evidence блокируют rollout.

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

# Module: Audience Intelligence

- Статус: `DRAFT / IMPLEMENTATION BLOCKED BY DISCOVERY GATE`
- Продукт: **Инструменты**
- Название в интерфейсе: **Аудитории**
- Код: `audience-intelligence`
- Маршрут: `/tools/audiences/`
- PostgreSQL schema: `audience`
- Риск: `RISKY`
- Версия: `v0.2-draft`
- Bright Data проверен: `2026-09-14`

## 1. Исправленное решение

Предыдущее ТЗ ошибочно считало Bright Data источником поиска Instagram-аудитории. Официальный Instagram Social Media Scraper API Bright Data принимает уже известный URL или точный username. Даже `posts/reels discover by URL` требует URL известного профиля. Поиск профилей по городу, полу, возрасту, интересам, ключевой фразе или хэштегу не заявлен.

Модуль поэтому имеет два независимых контура:

```text
AudienceDiscoveryProvider
-> находит ссылки/handles кандидатов

SocialProfileProvider + SocialContentProvider
-> обогащают известные профили и их контент
```

Bright Data v0.1 допускается только во втором контуре. Discovery provider не выбран. До Epic 0 запрещено обещать сценарий «Краснодар, женщины 40+, 2 000–5 000 профилей» и начинать реализацию поиска.

Если discovery не доказан, честный продукт v0.1 — **обогащение загруженного списка профилей**, а не поиск аудитории.

## 2. Назначение и сценарии

Модуль внутри существующего `ToolsProject` отвечает за discovery, обогащение, нормализацию, дедупликацию, evidence, ручную проверку, бюджет и приватный XLSX.

Режимы:

| Mode | Источник кандидатов | Статус |
| --- | --- | --- |
| `DISCOVERY_AND_ENRICHMENT` | доказанный discovery provider | заблокирован до Epic 0 |
| `LIST_ENRICHMENT` | CSV/XLSX с URL/username владельца | допустимый fallback v0.1 |

Целевые сценарии:

1. Найти новую аудиторию по доказанно поддержанным критериям, затем обогатить профили.
2. Загрузить известные URL/username и получить нормализованные профили, публичные контакты и evidence.
3. Для отобранных известных профилей собрать ограниченное число публикаций/Reels и тематические признаки.

География, пол, возраст и интересы — вероятностные выводы по публичным сигналам, не достоверные факты.

Не входят в v0.1: закрытые данные, обход авторизации, биометрия, outreach/рассылки, продажа баз, универсальный scraper, прямой Bright Data MCP, REST без клиента, объединение PII разных проектов, хранение видео, платный вызов без approval.

## 3. Gate и границы

Epic 0 заканчивается решением владельца:

- `GO_DISCOVERY` — источник кандидатов и его входы доказаны;
- `GO_LIST_ENRICHMENT` — v0.1 принимает только готовые profile refs;
- `STOP` — модуль не реализуется.

Без решения статус `BLOCKED`.

Целевая структура — `src/modules/audience-intelligence/{domain,application,infrastructure,presentation}` плюс `index.ts`, `server.ts`, `worker.ts`.

- используются существующие `tools.ToolsOrganization`, `tools.ToolsProject`, `tools.ToolsMembership`, `tools.ToolsProjectAccess`;
- свои organization/project/grant таблицы запрещены;
- domain не знает Next.js, MCP, S3, pg-boss, Prisma, XLSX или провайдера;
- UI и MCP используют одни application commands/queries;
- credentials существуют только в server/worker infrastructure;
- страницы: `src/app/tools/audiences/*`, UI: presentation модуля.

## 4. Provider ports

`AudienceDiscoveryProvider`: `getCapabilities`, `estimate`, `start`, `getStatus`, `downloadResult`, optional `cancel`. Он обязан объявлять platforms, seed types, filters, pagination, batch, price и ограничения. Неподдерживаемая комбинация отклоняется до estimate.

`SocialProfileProvider` имеет тот же async lifecycle, но принимает только известные URL/username и не имеет search semantics.

`SocialContentProvider` принимает известные profile/content URLs и caps. Его нельзя использовать как скрытый discovery provider.

Bright Data Instagram v0.1:

| Capability | Поддержка |
| --- | --- |
| профиль по известному URL | да |
| профиль по точному username | да |
| публикации/Reels известного профиля | да |
| комментарии известного контента | отдельный scope |
| поиск профилей по городу/полу/возрасту/интересам | нет |
| поиск профилей по keyword/hashtag | не доказан, считать `false` |

Marketplace Dataset, SERP API и custom datasets Bright Data не являются автоматически этим adapter. Каждый требует отдельного spike, цены и provider contract.

## 5. Input, policies и лимиты

- `mode`: один из двух режимов; после первого Run неизменяем;
- `targetProfileCount`: `1..5000`;
- `maxCandidateCount`: `target..25000`;
- `enrichmentPolicy`: `PROFILE_ONLY | PROFILE_AND_RECENT_CONTENT`;
- `manualReviewPolicy`: `NONE | BORDERLINE | ALL`;
- `deduplicationPolicy`: `PROJECT_PLATFORM_EXTERNAL_ID_THEN_CANONICAL_URL`;
- stop: target, candidate cap, budget cap или deadline — первое достигнутое.
- pilot дополнительно хранит `maxQualifiedContactCostKopecks`; внешний AI classifier и web contact enrichment в v0.1 запрещены до отдельного доказанного trigger.

Upload: CSV UTF-8/XLSX, до 25 000 строк и 50 MB. Provider batch до 1 000 refs. Невалидные строки не отправляются и идут в Errors.

Content: до 20 items/profile и 50 000/run; biography до 5 000 символов; evidence excerpt до 500; allowlisted provider metadata до 64 KiB/operation; response до 250 MB compressed, 1 GB decompressed и 250 000 rows. Превышение: `PROVIDER_RESULT_LIMIT_EXCEEDED`.

Один paid Run на ToolsOrganization; worker concurrency 1 до capacity proof. Snapshot deadline 6 часов, максимум 72 polls с задержкой `1m -> 2m -> 5m`. Timeout: `PROVIDER_SNAPSHOT_TIMEOUT`; accepted external ID сохраняется, повторный trigger запрещён.

## 6. Pipeline

```text
DISCOVERY mode:
VALIDATE_SCOPE -> ESTIMATE -> OWNER_APPROVAL -> DISCOVER
-> NORMALIZE_REFS -> DEDUPLICATE -> COLLECT_PROFILES
-> EXTRACT_PUBLIC_CONTACTS? -> COLLECT_CONTENT?
-> BUILD_EVIDENCE -> CLASSIFY -> REVIEW -> EXPORT

LIST mode:
INGEST_PROFILE_REFS -> общий pipeline с NORMALIZE_REFS
```

Run immutable после запуска; `PARTIAL != SUCCESS`; stage хранит counters, timestamps, attempts и safe error. Provider retry допустим только если операция доказанно не принята. После acceptance используется poll/reconcile.

## 7. Data ownership

`audience` — SQL-owned schema. Модели не добавляются в `prisma/schema.prisma`: только immutable handwritten SQL migrations и typed parameterized `pg` repositories, как в Research. SQL-сущность называется `AudienceProviderOperation`, чтобы не конфликтовать с существующей Prisma `ProviderOperation`.

Сущности: `AudienceStudy`, `AudienceCriterion`, `AudienceSeed`, `AudienceRun`, `AudienceRunStage`, `AudienceProviderOperation`, `AudienceProfile`, `ProfileObservation`, `ProfileContact`, `AudienceEvidence`, `AudienceAssertion`, `SocialContent`, `AudienceExport`, `ProviderSnapshot`, `AudienceReviewDecision`, `AudiencePricePolicy`.

Инварианты:

- каждая business row хранит exact Tools `organizationId/projectId`;
- composite FK исключают cross-scope связи; RLS deny-by-default;
- профиль уникален по project/platform/externalId, fallback — canonical URL;
- cross-project dedup запрещён;
- все `*At` — `timestamptz(3)` UTC;
- secrets/tokens не хранятся в таблицах.

## 8. Evidence и score

Критерий: `HARD | SOFT`; observation: `MATCH | CONTRADICT | UNKNOWN`; confidence `0..1`; SOFT weight `1..100`.

Правила:

1. HARD CONTRADICT с достаточной confidence => `rejected`.
2. HARD UNKNOWN не может дать `qualified`.
3. В SOFT входят только MATCH/CONTRADICT с confidence >= requiredConfidence.
4. value = 1 для MATCH, 0 для CONTRADICT.
5. `score = sum(weight * confidence * value) / sum(weight * confidence)`.
6. `coverage = evaluatedSoftWeight / totalSoftWeight`.
7. policy v1: qualified при score >= 0.70, coverage >= 0.60 и всех HARD MATCH; rejected при HARD fail либо score < 0.40 с coverage >= 0.60; иначе needs_review.

Policy версионируется в Run. Отсутствие evidence не превращается в отрицательный факт. Bright Data `avg_engagement` хранится как `providerEngagementRate` с provider/schema version; null не равен нулю.

## 9. Queue, worker и schema drift

- transaction создаёт Run, budget reservation, AuditEvent, OutboxEvent;
- topic `audience.run.v1`;
- `OutboxEvent.organizationId = NULL`: его FK относится к legacy SEO Organization;
- authoritative scope только в versioned payload: `toolsOrganizationId`, `toolsProjectId`, `runId`, `correlationId`, `version`;
- `AuditEvent.productCode = "tools"`, `source = "audience-intelligence"`;
- worker не использует `hasPermission(jobPrincipal, ...)`; он валидирует payload, читает Run/scope/status и вызывает `setDatabaseJobContext` перед каждой transaction batch;
- projectId в job обязателен; RLS — второй контур;
- idempotency запуска/экспорта module-local unique keys, без второй параллельной системы.

Polling: delayed pg-boss job через queue adapter с `startAfter`; `pollDueAt` хранится в operation, recovery sweep восстанавливает потерянную delivery. `sleep` внутри занятого job запрещён.

Worker delivery: collector import, команды `audience-run`/`audience-daemon` в `src/worker/main.ts`, `worker:audience:run`, отдельный Compose service/healthcheck, heartbeat/readiness, runbook, immutable image.

Schema drift:

- versioned Zod schemas в adapter;
- unknown fields игнорируются после allowlist и дают metric;
- отсутствие identity field — row error;
- >5% identity errors или полностью непригодный ответ => PARTIAL/FAILED;
- adapter/response schema version сохраняются;
- full raw snapshot 7 дней; sanitized diagnostic sample до 100 rows/10 MB — 30 дней;
- drift threshold создаёт alert.

## 10. Budget и валюта

Audience budget независим от Research. Provider fact хранится как `providerCostMinorUnits + providerCurrency`. Контроль АМС — в RUB kopecks через versioned `AudiencePricePolicy`: currency, unit prices, `fxRate`, `fxRateSource`, `fxRateAt`, conservative markup, version.

Автоматического FX API в v0.1 нет. Operator обновляет policy вручную; Run сохраняет snapshot. Непокрытая валюта/price model блокирует запуск.

```text
estimate -> reserve -> explicit owner approval -> enqueue
-> execute -> reconcile actual
```

Approval привязан к exact Study version, estimate, hard cap, price policy и expiry. Изменение аннулирует approval.

## 11. Authorization, PII и retention

Audience permissions добавляются в `PRODUCT_PERMISSIONS`, `ResourceRef.product = "tools"`:

`audience:read/create/update/estimate/run/review/export-masked/export-contacts/manage-provider`.

| Role | Права |
| --- | --- |
| VIEWER | read, masked export |
| ANALYST | create/update/estimate/run/review, masked export |
| OPERATOR | Analyst + contact export |
| PLATFORM_ADMIN | provider management; tenant action только с exact scope и audit |

Гранты: `tools.ToolsMembership` и `tools.ToolsProjectAccess`. UI navigation не заменяет query/command/worker/MCP authorization.

v0.1 принимает только public profiles. Private profile сразу отклоняется. Contacts допустимы лишь при явной публикации владельцем профиля и с provenance. Стороннее people-search enrichment не входит.

До contact schema/extraction/export обязателен human legal/privacy gate. Кодекс не объявляет обработку законной самостоятельно.

Storage: отдельный Audience PII prefix/bucket, private only, SSE-S3 AES256 минимум, отдельная worker IAM policy, SHA-256, без PII в object key, S3 lifecycle как второй контур. Прямой signed S3 URL в MCP запрещён.

Retention: raw 7 дней; diagnostic sample 30; uploaded file 30 после Run; normalized/evidence 180 после активности; contacts 90; XLSX 7; audit/budget по platform policy. Используется существующий platform-operations runner, без второго scheduler. Если `RetentionRun` не вмещает counters, он расширяется additive platform migration.

## 12. XLSX export

До dependency change обязателен ADR: официальная документация, лицензия, maintenance, streaming support. Генерация только в worker через streaming writer/bounded temp file. Storage port расширяется до generic `putObject(...)`, не ломая Research `putCsv`.

Caps: fixture 5 000 profiles; workbook <=100 MB; extra peak RSS <=256 MB; neutralization значений `= + - @`; IDs/телефоны без потери точности; checksum и row counts до публикации.

Листы: `README`, `Profiles`, `Contacts`, `Evidence`, `Content`, `Seeds`, `Run_Stages`, `Errors`, `Data_Dictionary`. Masked export исключает email/phone и чувствительные excerpts.

## 13. Application, MCP и UI

Commands: create/update Study, upload refs, estimate, approve, start Run, review, create/redeem Export, archive. Queries: list/get Study, get Run, list Profiles, get Evidence, get capabilities.

MCP v0.1: `audience_create_study`, `audience_upload_profile_refs`, `audience_estimate_run`, `audience_approve_run`, `audience_start_run`, `audience_get_run`, `audience_list_profiles`, `audience_get_profile_evidence`, `audience_create_export`, `audience_create_export_redeem_token`.

MCP возвращает bounded JSON и masked contacts. Download: одноразовый AMS token, subject/org/project/export bound, TTL <=60 sec, single-use; после fresh auth AMS route стримит файл. REST отложен до реального клиента.

UI routes: `/tools/audiences/`, `/new/`, `/[studyId]/`, `/[studyId]/exports/`. Обязательны состояния unsupported capability, estimate expired, approval required, queued, partial, failed, needs_review, export expired. До запуска UI явно говорит: поиск или обогащение, вероятностные признаки, expected range, max cost, retention/export composition.

## 14. Эпики

1. **Discovery viability gate**: официальные capabilities/account datasets; отдельно проверить Marketplace/Discover/SERP; сравнить минимум два discovery-пути; controlled proof; решение `GO_DISCOVERY | GO_LIST_ENRICHMENT | STOP`. Без измеренного yield/cost нет обещания 2–5 тыс. Pilot success требует: стоимость qualified-профиля с публичным контактом не выше заранее подтверждённого `maxQualifiedContactCostKopecks`, а доля профилей с location confidence >=0.60 — не ниже 30%; иные пороги задаёт владелец до paid run.
2. **ADR package**: discovery/mode, XLSX, money/FX, raw PII storage/retention.
3. **Domain/capabilities/product registration**: policies, limits, ports, safe errors.
4. **SQL/repositories/RLS**: handwritten migration, composite constraints, typed pg, timestamptz.
5. **Authorization/PII/retention**: permissions, grants, deny tests, storage/lifecycle, legal gate.
6. **Bright Data profiles**: known URL/username only, async lifecycle, Zod drift, bounded fixtures.
7. **Discovery adapter или upload intake**: реализуется по решению Epic 0; unsupported filters fail before estimate.
8. **Budget/queue/poll/recovery**: approval, exact outbox/audit, delayed jobs, locks, worker delivery.
9. **Normalization/evidence/classification**: canonical refs, dedup, formula, null semantics.
10. **Public contacts**: только после legal approval; provenance, masking, retention.
11. **Optional content**: posts/Reels известных profiles, caps, no media files.
12. **XLSX**: streaming, nine sheets, 5k/memory/injection/checksum, redeem flow.
13. **MCP + private cabinet**: shared application contract, exact scope, responsive states.
14. **Operational hardening/pilot**: metrics, alerts, recovery/timeout/drift drills, <=200 candidates, actual cost, runbook/rollback.

TikTok/X и REST — отдельные будущие streams после capability spike.

## 15. Gates и Definition of Done

Code epics с PII/auth/SQL/provider/paid/worker/dependency — `RISKY`. Перед merge один exact-head SourceCraft `risky-check` с релевантными unit и integration files; полный daily не повторяется на каждом эпике. Docs-only gate может быть STANDARD.

Proof: unit policies/score/bounds/mapping; PostgreSQL RLS/concurrency/budget/retention; provider drift/async; worker outbox/poll/recovery; MCP scope/replay/masking; export 5k/memory/injection; controlled external proof только после approval.

v0.1 готов, когда mode честно выбран; unsupported search не принимается; Bright Data ограничен доказанными capabilities; Tools scope защищён grants/RLS/worker; paid call требует approval; ambiguous retry исключён; score воспроизводим; PII masked/removed по retention; XLSX bounded; MCP не получает secrets/signed S3 URL; exact-head proof зелёный; pilot подтвердил yield, cost и ограничения.

## 16. Официальные источники

- [Social Media Scraper APIs](https://docs.brightdata.com/api-reference/scrapers/social-media-apis/overview)
- [Instagram profiles: collect by URL](https://docs.brightdata.com/api-reference/scrapers/social-media-apis/instagram-profiles-collect-by-url)
- [Instagram profiles: discover by username](https://docs.brightdata.com/api-reference/scrapers/social-media-apis/instagram-profiles-discover-by-username)
- [Instagram posts: discover by profile URL](https://docs.brightdata.com/api-reference/scrapers/social-media-apis/instagram-posts-discover-by-url)
- [Instagram reels: discover by profile URL](https://docs.brightdata.com/api-reference/scrapers/social-media-apis/instagram-reels-discover-by-url)
- [Instagram Marketplace Dataset](https://brightdata.com/products/datasets/instagram)

Marketplace marketing claims не заменяют endpoint contract и controlled proof конкретного аккаунта.

## 17. Итог

```text
Audience Intelligence = отдельный Tools-модуль.
Discovery и enrichment = разные provider ports.
Bright Data = enrichment известных Instagram refs.
Instagram discovery provider = TBD и обязательный Epic 0 gate.
Без discovery proof поставляется только List Enrichment.
REST, новые платформы и outreach не входят в v0.1.
```

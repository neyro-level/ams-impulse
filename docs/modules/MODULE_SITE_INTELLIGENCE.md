# Module: Site Intelligence

Status: `ACTIVE SPECIFICATION`

Implementation: `PLANNED`

Product: **Инструменты**

Display name: **Разбор сайтов**

Technical code: `site-intelligence`

Primary interface: remote AMS MCP at `/mcp`

Secondary interfaces: protected HTTP API v1 and private cabinet

Updated: `2026-09-14`

## 1. Назначение

«Разбор сайтов» собирает воспроизводимые доказательства о сайте, превращает их в структуру, SEO-факты и сопоставимые профили, а затем отдаёт эти результаты пользователю и AI через единый application contract.

Основной пользователь — владелец АМС и назначенные аналитики. Основной рабочий сценарий — из Codex, Cursor или другого MCP-клиента с любого компьютера подготовить разбор своего сайта и сайтов конкурентов, запустить ограниченный сбор, получить структуру и использовать её при проектировании SEO-ядра, архитектуры сайта и коммерческого предложения.

Модуль является самостоятельным подмодулем продукта `tools`. Он не является копией Research, не создаёт новый product code и не переиспользует таблицы Research как собственное хранилище.

## 2. Решения владельца

1. Пользовательское название — **«Разбор сайтов»**.
2. Техническое имя модуля и schema — `site-intelligence` / `site_intelligence`.
3. Модуль живёт внутри `ToolsOrganization -> ToolsProject`.
4. MCP — основной пользовательский вход; подключение должно работать удалённо с любого компьютера.
5. Защищённый HTTP API v1 входит в первый production-ready релиз, даже если сначала почти не используется.
6. Стартовый предел — 3 сайта × 5 страниц, не более 15 страниц на один запуск.
7. Сырой HTML сохраняется как временный технический исходник, а не как постоянная продуктовая база.
8. AI synthesis и автоматическая генерация финального SEO-ядра не входят в первый релиз.
9. Первый релиз использует прямой static/dynamic сбор. Архитектура сразу поддерживает сменные collection providers, но proxy/unlocker и stealth включаются только отдельным post-MVP Epic после проверки права на сбор, стоимости, качества и operational risk.
10. Instagram и другие социальные сети не входят в Site Intelligence: для них нужен отдельный source adapter/API contract.

## 3. Что является продуктовой ценностью

Постоянная база модуля — это не архив HTML. Ценность создают:

- карта обнаруженных URL и sitemap;
- классификация типов страниц и URL-шаблонов;
- очищенный Markdown ключевых страниц;
- нормализованные SEO- и контентные факты;
- версия профиля сайта;
- сравнение своего сайта с конкурентами;
- доказуемое происхождение каждого вывода: URL, время, content hash, extractor version и locator.

Сырой HTML нужен для повторного извлечения и диагностики в течение короткого окна без повторной нагрузки на чужой сайт. После истечения TTL он удаляется, а полезные факты и профиль остаются.

## 4. Основные сценарии

### UC-01 — Проектирование структуры SEO-сайта

1. Пользователь добавляет домен клиента и при необходимости до двух конкурентов.
2. Модуль читает `robots.txt`, sitemap и ограниченный набор страниц.
3. Система строит дерево URL, распознаёт повторяющиеся шаблоны и назначение страниц.
4. Пользователь получает основу для будущей архитектуры: разделы, посадочные страницы, фильтры, географические и продуктовые паттерны.

Ограничение: модуль даёт структуру и языковые сигналы, но не подтверждает поисковый спрос. Частотность и семантика подтверждаются Research/Wordstat/Topvisor отдельным workflow.

### UC-02 — Подготовка SEO-ядра

Из title, description, H1-H6, текста, breadcrumbs, меню, анкоров, schema.org и URL извлекаются:

- темы и сущности;
- товары, услуги, типы объектов и география;
- коммерческие модификаторы;
- повторяющиеся группы страниц;
- кандидаты на кластеры запросов и посадочные страницы.

Результат — evidence package для дальнейшего объединения с реальной поисковой семантикой. Модуль не выдаёт найденные слова за готовое SEO-ядро.

### UC-03 — Конкурентный анализ

Для одного собственного сайта и до двух конкурентов сравниваются:

- полнота структуры и типы посадочных страниц;
- глубина URL и покрытие sitemap;
- заголовки, контентные блоки и schema.org;
- внутренние ссылки и анкоры на собранной выборке;
- CTA, формы, доверительные и коммерческие элементы;
- технические SEO-сигналы и качество индексационных инструкций.

### UC-04 — Контентные разрывы

Система показывает страницы, темы и коммерческие блоки, которые есть у конкурентов и отсутствуют у собственного сайта. В MVP это детерминированное сравнение фактов. Оценка приоритета и генерация контента — отдельный будущий AI-этап.

### UC-05 — Разбор отдельной страницы

Пользователь вручную передаёт одну или несколько разрешённых URL и получает Page Snapshot: metadata, headings, чистый текст/Markdown, ссылки, schema.org, CTA/forms summary и screenshot при dynamic-сборе.

### UC-06 — Подготовка миграции или редизайна

Модуль создаёт исходный inventory URL, canonical/robots/status и типов страниц. Он помогает подготовить будущую redirect-map и content migration, но не публикует редиректы и не меняет целевой сайт.

### UC-07 — Повторный разбор и динамика

Каждый новый Run создаёт новый immutable snapshot. Сравнение версий структуры и страниц допускается после стабилизации MVP. Автоматический мониторинг по расписанию относится к LATER.

## 5. Пресеты первого релиза

| Preset | Для чего | Что собирает |
| --- | --- | --- |
| `SEO_STRUCTURE` | архитектура SEO-сайта | robots, sitemap inventory, URL patterns, metadata, headings, breadcrumbs, internal links |
| `COMPETITOR_REVIEW` | сравнение своего сайта и конкурентов | структура, content/SEO facts, CTA/forms/trust summaries, schema.org |
| `PAGE_REVIEW` | разбор точных URL | полный Page Snapshot для вручную заданных страниц |
| `FULL_MVP` | объединённый ограниченный разбор | все разрешённые MVP-факты в пределах лимитов |

Пользователь может добавлять URL вручную. Каждый URL проходит единый путь `normalize -> validate -> plan -> approve -> collect`. Прямого fetch по строке из MCP/API нет. Provenance хранит `source = manual` и `actorId`.

## 6. Out of Scope первого релиза

- генерация окончательного SEO-ядра без Wordstat/SERP evidence;
- LLM-выводы, тексты, рекомендации и автоматическая приоритизация;
- proxy/unlocker, stealth и решение Cloudflare challenge в первом production-релизе;
- authenticated crawling, cookies пользователя и личные кабинеты чужих сайтов;
- произвольные HTTP-методы, headers, proxy, CDP URL и browser flags из MCP/API;
- обход paywall, CAPTCHA, `robots.txt` или Terms of Service;
- сбор имён, личных телефонов, e-mail и других контактных ПД;
- массовый crawler на десятки тысяч загружаемых страниц;
- автоматическое изменение сайта, CMS, sitemap, robots или redirects;
- расписание повторных обходов;
- общий публичный Scrapling MCP.
- scraping Instagram, социальных сетей, поисковой выдачи и закрытых платформ.

## 7. Архитектурная граница

```text
Codex / Cursor / другой MCP-клиент
                 |
                 v
     AMS /mcp + OAuth 2.1/PKCE
                 |
Browser/UI -> Next.js routes/API v1
                 |
      Site Intelligence application
                 |
     defineCommand / query services
                 |
 PostgreSQL + Audit + Outbox + pg-boss
                 |
      site-intelligence-worker
                 |
     internal signed runner contract
                 |
   CollectionEnginePort adapters
         |              |
         v              v
 Scrapling Runner   approved managed fallback
                 |
 public HTTP/HTTPS sites only
```

### 7.1 Module boundaries

- `src/modules/site-intelligence/domain` — состояния, лимиты, ошибки, чистые правила.
- `src/modules/site-intelligence/application` — commands, queries, ports, DTO.
- `src/modules/site-intelligence/infrastructure` — PostgreSQL repositories, S3, runner client.
- `src/modules/site-intelligence/presentation` — private UI composition.
- `src/modules/site-intelligence/mcp` — bounded tools поверх application services.
- `src/modules/site-intelligence/index.ts` — browser-safe public types.
- `src/modules/site-intelligence/server.ts` — web/API/MCP composition root.
- `src/modules/site-intelligence/worker.ts` — worker composition root.
- `services/site-intelligence-runner/**` — только после принятого ADR о втором runtime.

Cross-module imports разрешены только через root entrypoints. Research может передавать кандидатов через опубликованный DTO, но не читать `site_intelligence` tables и не импортировать infrastructure.

### 7.2 Data owners

- Tools Workspace владеет organization/project/grants.
- Site Intelligence владеет review, targets, plans, runs, snapshots, facts, profiles, comparisons и artifacts.
- Platform Operations владеет AuditEvent, idempotency, outbox, queue transport, heartbeat и retention execution.
- Collection provider не владеет бизнес-данными. Scrapling Runner не имеет PostgreSQL/S3/OAuth credentials, а managed fallback получает только минимальный URL/collection contract и короткоживущую provider-авторизацию.

## 8. Выбор Scrapling и второго runtime

Scrapling является целевым кандидатом, но второй Python runtime нельзя принять только потому, что библиотека написана на Python. До implementation обязателен ADR со сравнением:

1. Node `fetch + Playwright 1.62.1 + собственный extractor`.
2. Python Scrapling, exact version `0.4.15` на дату проверки `2026-09-14`.
3. Управляемый provider fallback, прежде всего Firecrawl, только как внешняя ступень для страниц, которые не удалось законно получить базовым движком.

Сравниваются одинаковые static, dynamic, sitemap и noisy-page fixtures:

- успешность получения страницы;
- точность title/headings/links/schema extraction;
- качество Markdown и удаление prompt-injection noise;
- полнота sitemap/URL discovery;
- wall-clock;
- peak RSS и CPU;
- размер image и dependency surface;
- SSRF/robots/redirect controls;
- стоимость поддержки, обновления и security scanning.
- доля страниц, требующих browser/proxy/managed fallback, и стоимость одного полезного Page Snapshot;
- data processing, retention, регион хранения и vendor-lock-in внешнего provider.

Spike выполняется вне production branch. В repository попадают только measurements и ADR. Прототипный код, который не выбран для production, не мержится.

### Stop conditions

- на production-хосте нет подтверждённого memory headroom для одного Chromium плюс текущих web/workers;
- p95 dynamic page превышает 60 секунд на согласованном fixture set;
- runner невозможно изолировать от PostgreSQL/S3 и внешнего входящего трафика;
- SSRF revalidation после redirect/DNS невозможно доказать;
- качество результата не превосходит Node-вариант настолько, чтобы оправдать второй runtime.

Если Stop Condition срабатывает, модуль остаётся на том же application/data/MCP контракте, меняется только реализация `CollectionEnginePort`.

## 9. Какие возможности Scrapling используем

После положительного ADR допускаются:

- `Fetcher` для static HTML;
- `DynamicFetcher`/browser session только когда static-результат доказанно неполон;
- `SitemapSpider` и `LinkExtractor` для bounded discovery;
- `Response.markdown()` и `SiteToMarkdownSpider` как reference для чистого Markdown;
- CSS/XPath extraction;
- session reuse внутри одного Run;
- screenshots для выбранных dynamic pages;
- AutoThrottle;
- pause/checkpoint как внутренняя оптимизация, но не как product source of truth.

Обязательные overrides: `robots_txt_obey = True`, `concurrent_requests_per_domain = 1`, bounded delay, bounded retries и safe redirects.

Официальный Scrapling MCP не разворачивается как публичная поверхность AMS. Его 13 tools включают произвольные методы, sessions, cookies, proxies и stealth. Эти возможности шире бизнес-разрешений AMS и обходят tenant scope, AuditEvent, quotas, plan approval и persisted evidence.

Официальный `scrapling-official` Agent Skill допускается как справочник разработчика при реализации. Он не является runtime-зависимостью и не устанавливается пользователю для работы с «Разбором сайтов».

### 9.1 Режимы получения страниц

`CollectionEnginePort` проектируется сейчас, даже если первый релиз реализует только первые два режима.

| Режим | Назначение | Статус |
| --- | --- | --- |
| `DIRECT_STATIC` | обычные HTML-страницы, sitemap, robots и metadata | MVP default |
| `DIRECT_DYNAMIC` | публичные страницы, которым нужен JavaScript/Chromium | MVP fallback |
| `PROXY_PUBLIC` | публичная страница, когда нужен контролируемый исходящий IP, география или изоляция IP production-сервера | post-MVP, explicit approval |
| `MANAGED_SCRAPE` | сложная публичная страница через Firecrawl либо другой утверждённый provider | post-MVP, explicit approval |
| `AUTHORIZED_API` | данные платформы через официальный API и выданную владельцем авторизацию | отдельный source adapter |

Порядок escalation: `DIRECT_STATIC -> DIRECT_DYNAMIC -> остановка с BLOCKED`. Proxy или managed fallback не выбираются автоматически, пока для проекта/домена не приняты policy, budget и owner approval.

Для `PROXY_PUBLIC` и `MANAGED_SCRAPE` обязательны:

- allowlist доменов и подтверждённая цель сбора;
- соблюдение `robots.txt`, rate limits, Terms of Service и запрета на paywall/auth/CAPTCHA bypass;
- отдельный месячный и per-run budget, AuditEvent и kill switch;
- отсутствие пользовательских proxy URL, cookies, headers и stealth flags в MCP/API;
- provider credentials только в Doppler и только server-side;
- запрет отправки PII, приватных URL и tenant secrets внешнему provider;
- метрика причины fallback, результата, latency и стоимости;
- защита IP production-сервера: browser/proxy traffic идёт через изолированный runner/egress, а не через web runtime.

Scrapling `StealthyFetcher`, proxy rotation и Cloudflare-related функции считаются возможностями upstream, а не разрешением AMS на обход защиты. Их можно оценить в post-MVP spike только для публичных страниц, на сбор которых есть законное основание. CAPTCHA, логин, paywall, явный запрет владельца сайта и access-control не обходятся.

### 9.2 Почему не заменяем Scrapling сразу

- Для sitemap, структуры URL, metadata, headings, ссылок, schema.org, Markdown и screenshots Scrapling закрывает основной SEO-сценарий самостоятельно.
- Self-hosted runner оставляет URL и содержимое под контролем AMS и не создаёт постоянную оплату за каждую страницу.
- Firecrawl проще операционно и может лучше обслуживать сложные страницы через managed infrastructure, но добавляет стоимость, внешний data processor и зависимость от provider.
- Apify Proxy/Unblocker либо аналогичный provider может усилить Scrapling без замены всего application/data/MCP слоя.
- Bright Data и аналогичные enterprise-сервисы рассматриваются только после измеренной потребности: для лимита 15 страниц они избыточны по сложности и стоимости.

Рекомендованная конструкция: Scrapling остаётся базовым engine, Firecrawl — первым кандидатом на управляемый fallback, а конкретный proxy provider выбирается отдельным benchmark по успеху, стоимости и условиям обработки данных. Замена engine не меняет domain records, API или MCP.

### 9.3 Instagram и социальные сети

Scrapling технически может открыть публичную web-страницу через браузер, но Site Intelligence не обещает стабильный сбор Instagram: платформа требует авторизацию, активно ограничивает автоматизацию и меняет UI. Это не прямая задача данного движка.

Если бизнес-сценарий появится, он проектируется отдельным модулем/source adapter:

1. официальный Instagram API для авторизованных профессиональных аккаунтов — приоритетный путь;
2. только затем утверждённый специализированный provider для допустимых публичных данных;
3. отдельные permissions, retention, legal review, quotas и AuditEvent;
4. никаких login/password пользователя или session cookies в Scrapling/MCP.

## 10. Data Model

Schema: `site_intelligence`.

### 10.1 Основные записи

| Record | Назначение |
| --- | --- |
| `SiteReview` | контейнер пользовательского разбора |
| `SiteTarget` | project-owned canonical origin сайта |
| `SiteReviewTarget` | связь review с сайтом и ролью `OWN / COMPETITOR / REFERENCE` |
| `CollectionPlan` | immutable snapshot входов, правил выбора и лимитов |
| `CollectionTarget` | точный URL и ожидаемый collection mode |
| `CollectionRun` | один запуск утверждённой версии плана |
| `PageAttempt` | фактическая попытка получить страницу |
| `PageSnapshot` | metadata и ссылки на сохранённые source/Markdown/screenshot artifacts |
| `PageFact` | типизированный факт с locator/confidence/extractor version |
| `SiteProfile` | скомпилированная версия структуры и summary сайта |
| `SiteComparison` | детерминированное сравнение профилей |
| `Artifact` | private S3 metadata, hash, size, type и обязательный `expiresAt` |

### 10.2 Обязательные ключи

Каждая tenant-owned запись хранит `organizationId` и `projectId`. Обязательны:

- composite foreign keys к точному Tools project;
- unique `(organizationId, projectId, canonicalOrigin)` для `SiteTarget`;
- unique plan version внутри одного `SiteReview`;
- unique PageAttempt для `(runId, canonicalUrl, attemptNumber)`;
- content hash SHA-256 для каждого source/Markdown artifact;
- `FORCE ROW LEVEL SECURITY` и missing-context deny;
- запрет terminal Run при `PENDING/RUNNING` PageAttempt через application rule, PostgreSQL trigger/constraint и integration test.

### 10.3 Состояния

- SiteReview: `DRAFT | READY | ARCHIVED`.
- CollectionPlan: `BUILDING | READY | FAILED | SUPERSEDED`.
- CollectionRun: `QUEUED | RUNNING | CANCEL_REQUESTED | SUCCEEDED | PARTIAL | FAILED | CANCELLED`.
- PageAttempt: `PENDING | RUNNING | SUCCEEDED | SKIPPED | FAILED | CANCELLED`.

`partial != success`, `stale != current`, `null != 0`. Run получает `SUCCEEDED` только когда все обязательные targets терминальны и успешны. Часть успешных страниц при другом failure сохраняется, а Run становится `PARTIAL`.

### 10.4 Факты MVP

- requested/final URL, status, redirect chain;
- content type/language, response timing and size;
- canonical, meta robots, X-Robots-Tag, hreflang;
- title, meta description, H1-H6;
- breadcrumbs и navigation labels;
- internal/external links и anchor text;
- schema.org types и JSON-LD validity summary;
- word count, main-content hash, headings outline;
- CTA labels, form count/method/action origin без значений полей;
- sitemap membership, path depth, URL pattern and inferred page type;
- screenshot metadata для выбранных dynamic pages.

Контакты людей в PageFact не извлекаются. Если на странице есть публичные контакты, они остаются только в short-lived source/Markdown artifact согласно retention и не превращаются в отдельные searchable facts.

## 11. Raw HTML и retention

### 11.1 Решение

Сырой HTML сохраняется для каждого успешно собранного HTML target при `captureSource = true`, но:

- только в private S3, gzip-compressed;
- никогда не в PostgreSQL;
- никогда не передаётся модели, MCP-ответу или UI inline;
- никогда не индексируется и не попадает в embeddings;
- не содержит request cookies, authorization headers или `Set-Cookie`;
- имеет SHA-256, byte size, MIME, encoding, source URL и обязательный `expiresAt`;
- доступен только через отдельную чувствительную permission и fresh authorization;
- автоматически удаляется через два независимых механизма.

### 11.2 Сроки хранения

| Данные | Retention |
| --- | --- |
| `SiteProfile`, `PageFact`, URL inventory, plan/run metadata | пока существует ToolsProject или до явного удаления владельцем |
| очищенный Markdown | 180 дней |
| screenshots | 90 дней |
| raw HTML | 14 дней |
| export bundles | 30 дней |
| незавершённые runner temp files | до конца job, аварийный reaper не позднее 24 часов |
| signed download URL | максимум 60 секунд |

Удаление обеспечивают application reaper по `expiresAt` и S3 lifecycle policy. `expiresAt` для временного Artifact не может быть `NULL`. Изменение retention — отдельная data/privacy-задача.

### 11.3 Повторное извлечение

Пока raw HTML не истёк, application service может создать новый extraction pass с новой `extractorVersion` без внешнего HTTP-запроса. Старые PageFact immutable; новый профиль ссылается на новую версию. В первом UI/MCP этот служебный сценарий не обязан быть открыт пользователю, но port и data contract должны его поддерживать.

## 12. Collection Policy и лимиты MVP

| Limit | Начальное значение |
| --- | --- |
| сайтов в Run | 3 |
| загружаемых страниц на сайт | 5 |
| загружаемых страниц всего | 15 |
| wall-clock Run | 15 минут |
| static page timeout | 30 секунд |
| dynamic page timeout | 60 секунд |
| concurrent requests per domain | 1 |
| concurrent dynamic pages per Runner | 1 |
| discovered sitemap URLs per site | 5 000 |
| sitemap files per site | 20 |
| redirect hops | 5 |
| source HTML body | 2 MiB на страницу |
| sanitized Markdown | 512 KiB на страницу |
| internal Runner response | 8 MiB compressed / 16 MiB decoded |
| project quota | 60 fetched pages/day и 60 dynamic-browser minutes/day |

Лимиты являются server-owned policy. Клиент может запросить меньше, но не больше. Повышение разрешено только после production measurements по времени, памяти и ошибкам.

План содержит точные effective limits и прогноз времени. Idempotency key всегда выводится сервером из `planId + planVersion + canonical snapshot hash`; клиент не может передать собственный ключ.

## 13. URL и SSRF policy

Разрешены только публичные `http`/`https` URL и только безопасный `GET`/`HEAD` внутри Runner.

Запрещены:

- URL credentials;
- loopback, private, link-local, multicast, metadata и reserved IP;
- `file:`, `data:`, `ftp:`, `ws:` и нестандартные порты;
- redirect на запрещённый host/IP;
- произвольные headers, cookies, proxy и browser executable из пользовательского ввода;
- cross-origin form submission или XHR replay.

Hostname разрешается и проверяется до connect, повторно после каждого redirect и непосредственно перед фактическим socket connection. IPv4/IPv6 и DNS rebinding покрываются тестами. Проверка выполняется и в Node worker, и в Runner.

## 14. Runner contract

### 14.1 Внутренние endpoints

- `GET /internal/v1/health` — без внешних деталей.
- `POST /internal/v1/discover` — robots/sitemap/homepage discovery с bounded result.
- `POST /internal/v1/fetch-page` — один exact target, static/dynamic mode и bounded output.
- `POST /internal/v1/cancel` — cooperative stop текущего execution id.

Runner принимает только versioned schema и никогда не получает organization/project membership, database URL, S3 key, Better Auth/OAuth secrets или XMLRiver credentials.

### 14.2 Worker-to-Runner authentication

Loopback не считается аутентификацией. Каждый запрос подписывается HMAC по `method + path + timestamp + nonce + body hash` shared secret из отдельного protected env. Runner проверяет подпись, не принимает timestamp старше 60 секунд и блокирует повтор nonce.

Secret не передаётся через argv и не логируется. Ротация требует согласованного restart обоих сервисов.

### 14.3 Сеть

- `site-intelligence-worker` сохраняет `network_mode: host`, потому что ему нужен private route к Managed PostgreSQL.
- Runner работает в отдельной bridge network, не имеет публичного ingress и не подключается к database network.
- Runner port публикуется только на `127.0.0.1` хоста.
- Worker обращается к Runner по loopback URL.
- Nginx не маршрутизирует `/internal/*` к Runner.

Runner egress допускает только DNS и public HTTP/HTTPS targets; доступ к private ranges блокируется network policy плюс application SSRF guard.

## 15. Async, cancellation и failure contract

Очереди:

- `site-intelligence.plan.v1` — bounded discovery/plan preparation;
- `site-intelligence.collect.v1` — approved collection run;
- `site-intelligence.retention.v1` — artifact reaper.

Один persistent Node worker владеет pg-boss, PostgreSQL context, S3 upload и lifecycle. Runner — закрытый stateless/bounded executor.

Cooperative cancellation разрешена в любой момент. Command устанавливает `CANCEL_REQUESTED`; worker проверяет её между PageAttempt и перед каждым dynamic launch, отменяет Runner execution и завершает Run как `CANCELLED`, сохраняя уже собранные доказательства.

Retry допускается только для доказанно pre-request или safely retryable failure. После получения неоднозначного ответа страница не повторяется автоматически без policy. Robots deny, unsupported content, size limit и invalid target получают `SKIPPED` с безопасным кодом.

Kill switch `SITE_INTELLIGENCE_INTAKE_ENABLED=false` запрещает создание новых plans/runs без нового deploy. Активный Run корректно отменяется оператором или завершается по deadline.

## 16. Access, roles и audit

Permissions добавляются внутрь продукта `tools`, а не как четвёртый ProductCode:

- `site-intelligence:read`;
- `site-intelligence:manage`;
- `site-intelligence:run`;
- `site-intelligence:export`;
- `site-intelligence:source:read`.

Рекомендуемая матрица после обязательного решения по единому словарю ролей:

| Role | Permissions |
| --- | --- |
| `VIEWER` | read completed profiles/comparisons |
| `OPERATOR` | read, manage, run, export |
| `ANALYST` | OPERATOR + source:read и reprocess |
| `PLATFORM_ADMIN` | все действия, но с явным target organization/project |

Роль сама по себе не открывает проект. Нужен exact Tools project grant. Web, API и MCP используют свежий `PrincipalContext` и один `AuthorizationService`.

AuditEvent обязателен для:

- create/update/archive SiteReview;
- prepare/fail/supersede CollectionPlan;
- start/cancel/complete CollectionRun;
- raw-source download/reprocess;
- export create/download;
- import Research candidates;
- kill-switch/operator action.

Audit payload содержит только safe IDs, counts, statuses, planVersion, artifact type и correlationId. URL query, raw HTML, Markdown, contact data, signed URL и secrets не логируются.

## 17. Protected HTTP API v1

Base path: `/api/v1/site-intelligence`.

API реализуется в первом релизе поверх тех же application services, что MCP и UI. Он не является proxy к Runner.

### 17.1 Auth

- OAuth 2.1 user-delegated bearer, scope `api:site-intelligence`;
- token subject maps to Better Auth user;
- scope только сужает и никогда не расширяет AMS project grants;
- API keys и machine-to-machine service accounts — LATER;
- private responses: `Cache-Control: private, no-store`.

### 17.2 Endpoints

| Method | Path | Назначение |
| --- | --- | --- |
| `GET` | `/reviews` | доступные разборы, cursor pagination |
| `POST` | `/reviews` | создать draft |
| `GET` | `/reviews/{reviewId}` | review, sites, plan/run summary |
| `PATCH` | `/reviews/{reviewId}` | изменить draft по version |
| `POST` | `/reviews/{reviewId}/plans` | queued plan preparation |
| `GET` | `/plans/{planId}` | status, selected targets, limits, estimate |
| `POST` | `/plans/{planId}/runs` | подтвердить exact ready plan version и поставить Run в очередь |
| `GET` | `/runs/{runId}` | status, progress, safe failures |
| `POST` | `/runs/{runId}/cancel` | cooperative cancellation |
| `GET` | `/sites/{siteId}/profile` | текущий или указанный profile version |
| `GET` | `/sites/{siteId}/structure` | URL/template/sitemap structure DTO |
| `POST` | `/comparisons` | детерминированное сравнение разрешённых profiles |
| `POST` | `/exports` | создать private export bundle |
| `GET` | `/artifacts/{artifactId}/download` | fresh authorization и signed URL ≤60s |

Создание plan/run отвечает `202 Accepted`. Все errors используют platform envelope `{ ok: false, error: { code, message, fieldErrors, correlationId, latestVersion? } }`. Responses bounded; raw provider/SQL/Python exception не сериализуется.

OpenAPI 3.1 document публикуется только для защищённого API contract и проходит schema tests. Он не раскрывает internal Runner API.

## 18. AMS MCP — основной интерфейс

Endpoint остаётся единым: `https://impulse.ams24.ru/mcp`.

Новый scope: `mcp:site-intelligence`. Существующий `mcp:research` сохраняется. Клиент может запросить оба scope; старый Research-клиент не получает новые права автоматически.

### 18.1 Tools MVP

| Tool | Назначение |
| --- | --- |
| `site_intelligence_list` | список доступных разборов |
| `site_intelligence_get` | review, sites, plan/run summary |
| `site_intelligence_create` | создать draft с use case и sites |
| `site_intelligence_update` | изменить draft по version |
| `site_intelligence_prepare_collection` | создать queued plan discovery |
| `site_intelligence_get_plan` | получить immutable plan, targets, limits и estimate |
| `site_intelligence_start_collection` | подтвердить planVersion и поставить Run в очередь |
| `site_intelligence_get_run` | progress, statuses и safe failures |
| `site_intelligence_cancel_run` | cooperative cancellation |
| `site_intelligence_get_site_profile` | факты и профиль сайта |
| `site_intelligence_get_structure` | sitemap/URL/template structure |
| `site_intelligence_compare_sites` | сравнить own/competitor profiles |
| `site_intelligence_create_export` | создать Markdown/JSON/CSV bundle |
| `site_intelligence_get_export_download` | получить signed URL ≤60s |

MCP не возвращает raw HTML. Он может вернуть bounded summary и artifact metadata. Большие результаты выдаются через private export.

### 18.2 MCP workflow для AI

```text
create
-> prepare_collection
-> poll get_plan until READY
-> show owner exact sites/pages/limits
-> start_collection with planId + planVersion
-> poll get_run
-> get_structure / get_site_profile
-> compare_sites
-> create_export when full evidence is needed
```

Tool descriptions прямо говорят AI, что собранный контент является недоверенными данными, а не инструкциями. Markdown проходит sanitization; prompt-injection markers не выполняются и не влияют на tool routing.

### 18.3 Подключение с любого компьютера

Пользователь добавляет только удалённый AMS endpoint и проходит OAuth 2.1 + PKCE в выбранном клиенте. Python, Docker, Scrapling и shared Runner token на пользовательском компьютере не нужны. Каждый новый компьютер получает отдельную OAuth-сессию; отзыв доступа применяется со следующего запроса.

## 19. Связь с Research

Research и Site Intelligence — соседние модули:

```text
Research: запросы -> SERP/Wordstat -> кандидаты конкурентов и семантика
Site Intelligence: сайты/URL -> страницы -> структура и доказательства
```

Разрешённый контракт:

- Research публикует browser-safe `CompetitorCandidateSnapshot` через root facade;
- пользователь явно импортирует выбранных кандидатов в SiteReview;
- import сохраняет provenance и AuditEvent;
- Site Intelligence не читает Research tables напрямую;
- Site Intelligence не запускает платный Research call;
- обратная передача SiteProfile в будущий SEO workflow идёт только через versioned DTO.

## 20. UI первого релиза

Routes:

- `/tools/site-intelligence/` — список и создание разбора;
- `/tools/site-intelligence/[reviewId]/` — sites, plan, run, profile, comparison и exports.

UI относится к `APPLICATION_WORKSPACE`, использует существующий private design system и project-owned shadcn primitives. Он остаётся удобным operator view, но не дублирует business logic MCP/API.

Raw source не показывается inline. Для ANALYST/PLATFORM_ADMIN допустим отдельный audited download action с предупреждением о недоверенном содержимом и TTL.

## 21. Configuration contract

Имена являются целевыми и добавляются в `.env.example`, `docs/ENVIRONMENT.md` и fail-fast validation в том эпике, где появляется runtime:

- `SITE_INTELLIGENCE_WORKER_ID`;
- `SITE_INTELLIGENCE_RUNNER_URL`;
- `SITE_INTELLIGENCE_RUNNER_HMAC_SECRET`;
- `SITE_INTELLIGENCE_INTAKE_ENABLED`;
- `SITE_INTELLIGENCE_MAX_SITES_PER_RUN`;
- `SITE_INTELLIGENCE_MAX_PAGES_PER_SITE`;
- `SITE_INTELLIGENCE_MAX_PAGES_PER_RUN`;
- `SITE_INTELLIGENCE_RUN_TIMEOUT_SECONDS`;
- `SITE_INTELLIGENCE_STATIC_TIMEOUT_SECONDS`;
- `SITE_INTELLIGENCE_DYNAMIC_TIMEOUT_SECONDS`;
- `SITE_INTELLIGENCE_DAILY_PAGE_LIMIT`;
- `SITE_INTELLIGENCE_DAILY_DYNAMIC_MINUTES`;
- `SITE_INTELLIGENCE_RAW_HTML_TTL_DAYS`;
- `SITE_INTELLIGENCE_MARKDOWN_TTL_DAYS`;
- `SITE_INTELLIGENCE_SCREENSHOT_TTL_DAYS`.

Server policy задаёт safe maxima в коде. Env может уменьшить их, но не повысить выше reviewed ceiling без code change.

## 22. Обязательные tooling и production updates

Если ADR выбирает Python Runner, реализация обязана одновременно обновить:

- exact Python version и lockfile;
- pinned Scrapling version/image digest;
- Python lint/type/test/dependency/security checks;
- `.semgrep.yml` с Python rules;
- `scripts/risk-classify.ts` для `services/**`;
- `scripts/verify-architecture.mjs` и module boundary guards;
- `dependency-cruiser.config.cjs` для TS-side границ;
- manual-only SourceCraft RISKY cube без push/PR trigger;
- Dockerfile/Compose resource limits, health and read-only filesystem;
- `docs/ENVIRONMENT.md`, `.env.example`, `docs/PLATFORM_CONFORMANCE.md`;
- `docs/RUNBOOK_DEPLOY.md` и live proof для worker/Runner;
- backup/restore coverage PostgreSQL + private S3 metadata/lifecycle.

Runner не добавляется в production, пока host memory budget и rollback не доказаны.

## 23. Test matrix

### Domain/unit

- plan immutability и server-derived idempotency;
- state transitions и cooperative cancellation;
- limits/quotas and partial semantics;
- URL normalization, canonicalOrigin uniqueness;
- fact extraction fixtures и versioning;
- raw/Markdown/screenshots TTL.

### Runner

- static/dynamic fixtures;
- robots deny и crawl-delay;
- sitemap index/gzip/bounded discovery;
- redirect/DNS rebinding/private IP rejection;
- prompt-injection sanitization;
- HTML/Markdown/screenshot/response byte limits;
- HMAC, replay window and nonce rejection;
- cancellation, timeout, process/memory limit;
- no credentials and no private-network reachability.

### PostgreSQL integration

- same-project and cross-project isolation;
- missing user/job context deny;
- composite ownership and unique canonical origin;
- terminal Run cannot contain active PageAttempt;
- duplicate plan/run does not duplicate collection;
- quota concurrency;
- retention and audited sensitive actions.

### API/MCP

- allowed and denied OAuth scopes;
- revoked grant and disabled user fail on next request;
- guessed IDs return safe not-found/deny;
- MCP and API call the same application services;
- client idempotency key cannot override server key;
- raw HTML never appears in list/profile/tool/error output;
- output and pagination bounds.

### Release/live proof

- web, outbox, Research worker, Site Intelligence worker and Runner exact-image health;
- Runner is unreachable externally and from Nginx;
- one approved 1-site static smoke;
- one controlled dynamic smoke within memory ceiling;
- cancel during active collection;
- private export and expiry;
- reaper plus S3 lifecycle evidence;
- rollback stops intake and restores previous runtime without deleting saved facts.

## 24. Зависимости от открытого аудита

До старта реализации нужно проверить фактический `origin/main`, а не слепо переносить старые номера аудита. Блокирующие условия:

1. full-history secrets/PII scan GitHub mirror доказан или явно остаётся отдельным blocker;
2. единый permission dictionary и различие `OPERATOR/ANALYST` закрыты до добавления новых permissions;
3. свежая авторизация вне RSC `React.cache()` доказана для MCP/API до их расширения;
4. актуальный managed PostgreSQL restore proof подтверждён до добавления второго persistent storage contract;
5. memory headroom production-хоста измерен до browser Runner.

Если код уже закрыл пункт, новый Epic фиксирует evidence и не переписывает его повторно.

## 25. План реализации: один Epic = одна ветка = один PR

### EPIC-SI-01 — Runtime ADR и measurements (`RISKY`)

- внешний spike Node vs Scrapling;
- memory inventory production host;
- ADR с решением и Stop Conditions;
- никакого prototype runtime в `main`.

Done: выбран `CollectionEnginePort` adapter на доказанных метриках.

### EPIC-SI-02 — Domain, permissions, schema и RLS (`RISKY`)

- закрыть/подтвердить permission prerequisite;
- migration schema `site_intelligence`;
- domain state machines, limits, quotas;
- composite constraints, RLS, terminality trigger;
- AuditEvent contract.

Done: allowed/denied/cross-tenant integration proof проходит.

### EPIC-SI-03 — Закрытый Runner (`RISKY`)

- exact runtime/dependencies;
- internal discover/fetch/cancel/health;
- HMAC and anti-replay;
- SSRF/robots/byte/time controls;
- bridge/loopback topology;
- CI/security/architecture guards.

Done: Runner не имеет business credentials и недоступен извне.

### EPIC-SI-04A — Queue, worker и artifacts (`RISKY`)

- outbox + pg-boss queues;
- PageAttempt lifecycle, heartbeat, cancellation;
- S3 source/Markdown/screenshot artifacts;
- dual retention, kill switch, quotas;
- restore/recovery proof до merge.

Done: approved bounded Run сохраняет artifacts, переживает restart и отменяется без потери уже собранного.

### EPIC-SI-04B — Нормализация и профили (`STANDARD`, либо `RISKY` при новой migration)

- fact extractors и versioned evidence locator;
- URL/template/site structure compiler;
- SiteProfile и deterministic SiteComparison;
- fixtures для разных типов сайтов.

Done: одни и те же snapshots дают детерминированный профиль и сравнение.

### EPIC-SI-05 — Protected API v1 (`RISKY`)

- OAuth scope `api:site-intelligence`;
- versioned routes и OpenAPI 3.1;
- application-service reuse;
- rate/output/idempotency/access tests.

Done: полный lifecycle выполняется через API без Runner leakage.

### EPIC-SI-06 — Remote AMS MCP (`RISKY`)

- закрыть/подтвердить non-RSC auth prerequisite;
- scope `mcp:site-intelligence` рядом с `mcp:research`;
- 14 bounded tools;
- prompt-injection-safe descriptions и output limits;
- Codex/Cursor connection proof с двух компьютеров.

Done: пользователь с разрешённым ToolsProject выполняет основной workflow удалённо, а чужой scope отклоняется.

### EPIC-SI-07 — Private cabinet (`STANDARD`)

- list/detail routes;
- plan approval, progress, cancel, profile, comparison, exports;
- responsive/accessibility states;
- no raw inline rendering.

Done: operator может контролировать тот же lifecycle без MCP.

### EPIC-SI-08 — Production hardening и release (`RISKY`)

- environment/conformance/runbook/live proof;
- resource budgets and health;
- retention/reaper/S3 lifecycle;
- exact-head RISKY gate;
- owner-authorized rollout and live smoke;
- rollback/kill-switch drill.

Done: первый production release подтверждён exact SHA и не ухудшает web/Research workers.

### LATER-SI-09 — Controlled proxy и managed fallback (`RISKY`)

Только после первого production proof базового движка:

- измерить реальные причины `BLOCKED` на разрешённом fixture/domain set;
- сравнить Scrapling proxy adapter, Firecrawl и при необходимости Apify/Bright Data;
- принять provider/data-processing/budget decision;
- добавить domain allowlist, explicit approval, quotas, cost telemetry и kill switch;
- доказать, что режим не обходит auth, CAPTCHA, paywall, robots или запрет владельца;
- выполнить отдельный exact-head RISKY gate и owner-authorized release.

Done: сложный публичный URL обрабатывается утверждённым fallback только после явного разрешения, а отказ provider не нарушает основной Run и не раскрывает данные.

### LATER-SI-10 — AI synthesis и SEO workflow

После production-проверки evidence model:

- versioned synthesis prompt/model;
- facts отдельно от AI inference;
- связь SiteProfile + Research semantic evidence;
- предложения по SEO-структуре и gap priorities;
- отдельные budget, audit и human approval.

### LATER-SI-11 — Global AMS skill

Отдельной задачей в canonical global skills repository можно создать skill, который обучает Codex последовательности «Research -> Разбор сайтов -> SEO-архитектура». Skill не заменяет MCP authorization и не живёт в application repository.

## 26. Definition of Ready

- [ ] открытые audit prerequisites проверены по текущему `origin/main`;
- [ ] ADR и memory measurements приняты;
- [ ] permission matrix утверждена и не дублирует мёртвую роль;
- [ ] fixtures не содержат production/foreign PII;
- [ ] runner network/auth/SSRF contracts имеют тестируемый дизайн;
- [ ] S3 retention и restore owner определены;
- [ ] API/MCP OAuth scopes совместимы с существующим Research client.

## 27. Definition of Done MVP

- [ ] 3 сайта × 5 страниц обрабатываются в пределах 15 минут на target host;
- [ ] robots/SSRF/redirect/size/time policies fail closed;
- [ ] raw HTML хранится private не более 14 дней и не попадает в AI/MCP;
- [ ] Markdown, facts, structure и profile имеют provenance/version/hash;
- [ ] partial/cancelled states честно сохраняют собранное;
- [ ] API v1 и MCP используют один application contract;
- [ ] удалённый MCP подтверждён из Codex и Cursor минимум с двух компьютеров;
- [ ] tenant/project isolation доказана через PostgreSQL integration tests;
- [ ] Runner не имеет DB/S3/OAuth/XMLRiver credentials и внешнего ingress;
- [ ] AuditEvent, quotas, kill switch, retention и live health работают;
- [ ] proxy, stealth, managed fallback и social scraping отсутствуют в первом release artifact;
- [ ] документы, environment registry, platform conformance и deploy runbook обновлены;
- [ ] exact-head RISKY SourceCraft gate зелёный;
- [ ] production rollout выполнен только по отдельной команде владельца и имеет rollback proof.

## 28. Официальные источники Scrapling

Проверено `2026-09-14`:

- [официальный repository Scrapling](https://github.com/D4Vinci/Scrapling);
- [официальный MCP guide](https://scrapling.readthedocs.io/en/latest/ai/mcp-server.html);
- [MCP API reference](https://scrapling.readthedocs.io/en/latest/api-reference/mcp-server.html);
- [generic spiders: SitemapSpider, SiteToMarkdownSpider, LinkExtractor](https://scrapling.readthedocs.io/en/latest/spiders/generic-templates.html);
- [RAG-ready Markdown](https://scrapling.readthedocs.io/en/latest/ai/building-rag-systems.html);
- [concurrency, robots, AutoThrottle и pause/resume](https://scrapling.readthedocs.io/en/latest/spiders/advanced.html);
- [StealthyFetcher и browser capabilities](https://scrapling.readthedocs.io/en/latest/fetching/stealthy.html);
- [proxy rotation и blocked-response handling](https://scrapling.readthedocs.io/en/latest/spiders/proxy-blocking.html);
- [official releases](https://github.com/D4Vinci/Scrapling/releases);
- [PyPI package `0.4.15`](https://pypi.org/project/scrapling/).

На дату проверки `0.4.15` содержит breaking changes MCP и остаётся быстро меняющейся `0.x`-линией. Exact version/digest фиксируются только после ADR и повторной проверки перед dependency commit.

## 29. Официальные сравнительные источники

Проверено `2026-09-14`:

- [Firecrawl: scrape, crawl, map, search и structured extraction](https://docs.firecrawl.dev/introduction);
- [Firecrawl scrape formats и actions](https://docs.firecrawl.dev/api-reference/endpoint/scrape);
- [Firecrawl proxy/stealth modes](https://docs.firecrawl.dev/features/stealth-mode);
- [Apify Proxy](https://docs.apify.com/proxy);
- [Apify Unblocker](https://docs.apify.com/proxy/unblocker);
- [официальный Instagram API workspace Meta](https://www.postman.com/meta/instagram/collection/6yqw8pt/instagram-api).

Сравнительные ссылки фиксируют доступные capability, но не являются автоматическим выбором provider. Перед implementation повторно проверяются актуальная документация, тариф, обработка данных и contractual restrictions.

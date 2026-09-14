# PRODUCT

Этот документ - единственный product/PRD source of truth AMS IMPULSE. Реализованное поведение определяет canonical `main`, а production availability определяется deployed exact SHA и его live proof.

## Назначение

AMS IMPULSE - личная CRM-платформа владельца АМС с частичным клиентским доступом. Она объединяет клиентские продукты и внутренние инструменты под одной identity-системой, но сохраняет жёсткие границы данных и разрешений.

## Статус Поставки

- `IMPLEMENTED`: SEO Монитор, модульное platform-ядро, Инструменты, Исследования, OAuth/MCP, приватный кабинет и static-only PWA находятся в canonical `main`.
- `DEPLOYED`: production release `2026-09-13` на exact SHA `1c5c3d6450a6934034f10ce15d91cdfb18da7659` подтвердил web, outbox worker, Research worker, managed PostgreSQL 18 и private read smoke.
- `PLANNED`: Аудитории, Разбор сайтов, АМС Лиды, Договоры, Счета, Презентации, Клон сайтов и внутренний AI-агент не имеют business runtime.

Docs-only commits после указанного release SHA не означают изменение production-функций и не требуют повторного deploy.

## Продуктовая Карта

### SEO Монитор

Клиентский продукт для регулярного SEO-контроля:

```text
SEO Organization
-> SEO Project
-> Site
-> Evidence / Report
```

Текущий работающий SEO-кабинет мигрирует в эту границу без изменения смыслов отчёта и стабильных `/c/*` маршрутов.

### АМС Лиды

Отдельный клиентский продукт:

```text
Leads Organization
-> Leads Project
-> Funnel
-> Lead
```

До реализации модуль не отображается как доступный. SEO organization/project не переиспользуются для лидов.

### Инструменты

Внутренний продукт с общим справочником:

```text
Tools Organization
-> Tools Project
-> Research / Audience Intelligence / Site Intelligence / Contract / Invoice / Presentation / Site Clone
```

Модули:

1. **Исследования** - реализован в canonical `main` и выпущен в production baseline `1c5c3d6`; платный запуск требует отдельного подтверждения рассчитанной стоимости. Production availability определяется deployed exact SHA.
2. **Аудитории** - запланированный provider-independent модуль discovery, обогащения, evidence и XLSX-экспорта публичных профилей. Discovery provider пока не выбран; Bright Data рассматривается только для известных URL/username и их контента. До решения Epic 0 доступен лишь fallback-концепт List Enrichment. Contract — `docs/modules/MODULE_AUDIENCE_INTELLIGENCE.md`.
3. **Разбор сайтов** - запланированный модуль сбора структуры, SEO-фактов и сопоставимых профилей публичных сайтов. Канон: [`modules/MODULE_SITE_INTELLIGENCE.md`](modules/MODULE_SITE_INTELLIGENCE.md).
4. **Договоры**.
5. **Счета**.
6. **Презентации**.
7. **Клон сайтов**.

Организация и проект создаются в Инструментах один раз. Все внутренние модули ссылаются на один `ToolsProject`.

## Пользователи И Доступ

### Platform Admin

Владелец платформы. Имеет global access, управляет пользователями и назначениями. Для действий с tenant data всё равно указывает целевой продукт и ресурс; изменения аудируются.

### Analyst

Внутренний сотрудник. Системная роль не открывает данные автоматически. Владелец явно назначает продукты и проекты. Для Research получает роль `ANALYST` на конкретные Tools projects.

### Client

Клиент. Видит только продукты и проекты, назначенные Platform Admin. Доступ к SEO не открывает АМС Лиды или Инструменты. Доступ к одному проекту не открывает соседние проекты организации.

### Worker / MCP Client

Worker действует в scope конкретного job. MCP действует от имени Better Auth user и не может расширить его effective access.

## Роли Продукта

- `VIEWER` - только чтение разрешённого проекта.
- `OPERATOR` - разрешённые рабочие изменения в клиентском продукте.
- `ANALYST` - работа с внутренними инструментами и запуск исследований.

Роли фиксированы кодом. Dynamic/custom roles вне первого релиза.

## Access Scenarios

Текущие исполняемые сценарии:

- SEO only: пользователь видит только SEO Монитор и назначенные SEO projects.
- Tools denied: раздел отсутствует в navigation, direct URL/API/MCP возвращает безопасный отказ.
- One project: sibling projects той же organization не видны.
- Revoked grant: web и MCP теряют доступ со следующего запроса, sessions отзываются.

Целевая матрица после реализации АМС Лиды:

- Leads only: пользователь видит только АМС Лиды и назначенные Leads projects.
- SEO + Leads: оба продукта видимы, scopes остаются независимыми.

## Исследования MVP

Пользователь с Tools Research permission:

1. выбирает разрешённые Tools organization/project;
2. создаёт черновик анализа конкурентов;
3. задаёт до 20 поисковых запросов;
4. получает оценку максимальной стоимости;
5. отдельно подтверждает `runId` и неизменившуюся серверную сумму;
6. worker собирает XMLRiver evidence;
7. система формирует детерминированную карту конкурентов;
8. пользователь читает историю, получает MCP-отчёт и создаёт CSV export.

MCP, кабинет и будущий внутренний AI используют один application contract.

## SEO Monitor Compatibility

Сохраняются:

- публичный landing и legal routes;
- Better Auth login без public signup;
- `/dashboard/`, `/analyst/`, `/admin/*`, `/notifications/`, `/c/*`;
- `SiteReportSnapshot` и периоды `week`, `month`, `quarter`, `halfYear`;
- Yandex read-only evidence и bounded Topvisor operations;
- значения `partial`, `stale`, `null` без маскировки.

Миграция доступа не должна расширить видимость существующего клиента. Каждый текущий client Membership преобразуется в explicit SEO project grants только для уже доступных проектов.

## Публичный Коммерческий Путь

Публичная страница предлагает обсудить архитектуру системы продаж и маркетинга, а не самостоятельную регистрацию или безусловный запуск проекта.

```text
Заявка с именем и телефоном
-> разбор процессов и данных
-> проектирование архитектуры до начала разработки
-> согласование формата и следующего шага
```

Public signup отключён. Наличие формы заявки не означает автоматическое создание аккаунта, запуск услуги или обещание результата в поисковой выдаче.

Форма собирает имя и телефон для ответа на заявку, требует согласие и передаёт данные только в allowlisted AMS Leads API. В запросе фиксируются время и scope согласия, а также пути к действующим документам. Локальная база AMS IMPULSE эти публичные заявки не хранит.

Публичные доказательства ограничены проверяемыми возможностями работающего продукта и подтверждёнными материалами владельца. До появления согласованных кейсов страница не публикует отзывы, клиентские логотипы, проценты роста или демонстрационные показатели как реальные результаты.

### Golden Journey SEO Monitor

```text
Вход
-> доступные SEO-проекты
-> выбранный проект
-> выбранный сайт
-> отчёт за явный период и часовой пояс
-> свежесть отчёта и состояние каждого источника
-> главная проблема и её деловое значение
-> рекомендуемое следующее действие
```

Правила маршрута:

- `/dashboard/` показывает доступные пользователю SEO-проекты или честное пустое состояние с объяснением следующего шага;
- `/c/{clientSlug}/` содержит только сайты из свежего server-side access scope;
- `/c/{clientSlug}/{siteSlug}/` сначала проверяет доступ к точному сайту, затем получает отчёт;
- неизвестный, соседний или отозванный project/site возвращает safe not-found без пустой оболочки и без раскрытия существования ресурса;
- первый экран отчёта всегда называет период, часовой пояс, время обновления, общую свежесть и состояние источников;
- `partial`, `stale`, `unavailable` и provider failure сопровождаются объяснением влияния на решение и безопасным следующим действием;
- отсутствие проблемы является явным результатом, а не dead end; при проблеме отчёт завершает путь конкретным приоритетом.

## Mobile And Installable

Кабинет проектируется mobile-ready. PWA поддерживает installable shell, но не кэширует sessions, PII, reports, exports или paid commands. Реальный Android/iOS device proof остаётся операционной задачей.

Native App Store/Google Play applications вне первого цикла.

PWA-код реализован в canonical `main`: manifest, install command и static-only allowlist service worker. Windows Chromium и production static-cache proof выполнены на release `1c5c3d6`; Android/iOS device proof подтверждается отдельно.

## Non-goals Текущего Продуктового Цикла

- реализация АМС Лиды;
- договоры, счета, презентации и клон сайтов;
- arbitrary permission editor;
- client self-service access administration;
- generic SQL/MCP tools;
- обязательный AI для Research report;
- автоматический production release без отдельной owner command.

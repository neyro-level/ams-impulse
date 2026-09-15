# MASTER PLAN

Документ содержит только незавершённую работу. Реализованные изменения сохраняются в Git и SourceCraft.

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

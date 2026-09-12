# MASTER PLAN

Документ содержит только незавершённую работу. Реализованные изменения сохраняются в Git и SourceCraft.

## Следующий Release

Только после отдельной команды владельца:

1. Выпустить reviewed exact SHA canonical `main` по `docs/RUNBOOK_DEPLOY.md`.
2. Подтвердить release record, image digest, migration state, web/outbox/research-worker readiness и fresh Timeweb backup proof.
3. Выполнить live smoke изменённых SEO Monitor, Research, Platform Admin и PWA-сценариев без публикации PII/readiness body.

Merge не является release. До владельческой команды эти пункты остаются операционными и не блокируют завершение кода remediation.

## Внешние Проверки

- выполнить первый подтверждённый платный тестовый запуск Research через MCP после серверной оценки и явного подтверждения стоимости;
- проверить историю запуска, карту конкурентов и короткоживущую приватную CSV-ссылку на отдельном тестовом Tools project;
- проверить восстановление Research job после контролируемого перезапуска выпущенного worker без повторения неоднозначного paid call;
- подтвердить OAuth/MCP ещё на двух локальных компьютерах;
- проверить установку и private-cache поведение PWA на реальных Android и iOS устройствах; Windows Chromium proof выполнен;
- проверить responsive кабинет с реальными test data на `375`, `768`, `1280`, `1440` после выпуска exact SHA.

## Следующие Продуктовые Эпики

1. Договоры.
2. Счета.
3. Презентации.
4. Клон сайтов.
5. АМС Лиды.
6. Внутренний AI-агент поверх Research application contract.

Каждый пункт - отдельная ветка, PR, review и risk-based gate.

## Операционные Задачи

- до `2026-09-25` проверить стабильность managed PostgreSQL и только отдельным решением удалить прежнюю read-only БД;
- после ротации Timeweb API token сохранить новый операторский токен в AMS IMPULSE Doppler через identity с write-доступом;
- синхронизировать ротированные DB credentials в AMS IMPULSE Doppler, не меняя раздельные runtime identities;
- завершить безопасное подключение существующих SEO provider mappings;
- подтвердить SourceCraft secret scanning;
- завершить sanitation GitHub mirror до public visibility;
- добавить внешний monitor без публикации readiness body.

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
- выполнить отдельный full-history secrets/PII scan уже публичного GitHub mirror; current-tree проверки не заменяют history proof;
- добавить внешний monitor без публикации readiness body.

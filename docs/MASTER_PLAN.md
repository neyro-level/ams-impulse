# MASTER PLAN

Документ содержит только незавершённую работу. Реализованные изменения сохраняются в Git и SourceCraft.

## Audit Remediation 2026-09-13

Работа выполняется последовательно отдельными эпиками и Pull Request. Каждый
следующий зависимый эпик начинается от обновлённого `origin/main` после merge
предыдущего; production выпускается один раз после завершения всей программы.

1. **Research queue disposition (`RISKY`)** — убрать ложный failure при
   `lock-busy`, сохранить ровно одну будущую попытку и закрепить regression proof.
2. **Research money and UTC (`RISKY`)** — сохранять распределённую стоимость при
   внутреннем сбое, унифицировать UTC-границы бюджета, закрепить session timezone
   и честную семантику расчётной стоимости XMLRiver.
3. **CSP perimeter (`STANDARD`)** — один CSP для service worker, минимальный
   `connect-src`, документированное временное `unsafe-inline` исключение.
4. **UI foundation v5 (`RISKY`)** — Tailwind `@theme`, semantic utilities,
   typography/layout primitives, чистая граница `globals.css`, dark/motion contract.
5. **UI composition and proof (`STANDARD`)** — semantic sections публичного
   лендинга, синхронизация Design System v5, расширенный drift guard и browser/a11y
   proof всех изменённых page families.

Аудиторское утверждение о мультипликативном росте Research jobs уточнено по
фактическому `RESEARCH_JOB_RETRY_LIMIT = 0`: retry исходного job не создаётся.
Реальный дефект эпика 1 — обычная lock-конкуренция ошибочно записывается как
failure вместо нормального `complete + one deferred send`.

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

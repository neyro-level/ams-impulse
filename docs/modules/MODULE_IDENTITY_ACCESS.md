# Module: Identity Access

## Назначение

Better Auth управляет identity, password, session и OAuth records. AMS управляет `systemRole`, продуктовыми memberships, явными project grants, permissions и audit.

## Web Principal

Сервер создаёт нейтральный principal без выбора «первой организации»:

- `platform-admin` - единственный global bypass;
- `identity-user` + `ANALYST | CLIENT` - требует продуктовых назначений;
- `job` - ограниченный серверный процесс;
- `api-client` - зарезервирован, не даёт пользовательский доступ.

Legacy-типы `platform-analyst` и `tenant-user` остаются совместимыми внутренними контрактами старого SEO-кода, но новая web-сессия их не создаёт.

## Назначения

- SEO: `Member -> SeoProjectAccess`.
- Инструменты: `ToolsMembership -> ToolsProjectAccess`.
- АМС Лиды: таблицы запланированы, runtime отсутствует.

Membership не открывает все проекты. Роль каждого проекта задаётся отдельно: `VIEWER`, `OPERATOR`, `ANALYST`.

## OAuth И MCP

Better Auth `1.7.2` использует JWT, MCP OAuth Provider и CIMD. `/mcp` требует OAuth 2.1 authorization code + PKCE, scope `mcp:research`; access token живёт 300 секунд. Client credentials и универсальные admin tokens отключены.

Каждый MCP-вызов заново проверяет активного пользователя и текущие AMS grants. Отключение пользователя или отзыв назначения прекращают доступ со следующего запроса.

## Инварианты

- Public signup и произвольные роли отключены.
- Browser/URL/cookie/token claim не задаёт resource scope.
- Password reset, disable и изменение доступа отзывают web sessions.
- Успешная выдача/смена/отзыв доступа пишет безопасный `AuditEvent`.
- OAuth token не может расширить AMS grants.
- Password, session token, OAuth token и PII не попадают в DTO, logs или audit markers.
- Единственный legacy Platform Admin без TOTP восстанавливается только двухэтапной
  owner-CLI adoption: rotation password/session, выпуск offline recovery material и
  возврат authority лишь после TOTP verification.

## Проверки

Principal matrix, disabled user, session revocation, explicit project grants, cross-product denial, guessed UUID, OAuth scope и MCP authorization suite.

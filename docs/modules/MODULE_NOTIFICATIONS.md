# Module: Notifications

## Purpose

Owns browser-safe lifecycle notifications for operators and analysts: feed, filters, unread count, read/unread actions and mark-all-read.

## Not In Scope

Audit log, SyncRun/SourceRun truth, outbox truth, email/push delivery, secret-bearing incident log and client viewer notifications.

## Ownership

Models: `Notification`, `NotificationRead`.

Domain categories: onboarding, integration, report, ranking, competitor, data freshness, queue and access.

## Principals

- Platform Admin: sees platform/admin notifications.
- SEO Analyst: sees analyst-safe operational notifications.
- Tenant User / Client Viewer: no `/notifications/` route in current product.
- Job: may create safe notifications through ingestion/reliability flows.

## Commands And Queries

Queries return paginated browser-safe feed, filter options and unread count.

Commands:

- set one notification read/unread;
- mark all visible notifications read.

Every read mutation validates that the notification is visible to the current principal.

## Invariants

- Notification payload contains safe title/message/route only.
- No raw provider body, token URL, stack trace, email, phone or secret value.
- Dedup key prevents repeated noise for the same lifecycle event.
- Notification does not replace AuditEvent, SyncRun, SourceRun, OutboxEvent or logs.
- Client Viewer does not receive notification route until a product decision changes it.
- PostgreSQL enforces the same audience boundary: project notifications require a project grant, organization notifications require membership, and global or `PLATFORM_ADMIN_ONLY` notifications require Platform Admin.
- A user can read or change only their own `NotificationRead` rows for notifications that are visible to them.

## Tests

Visibility matrix, unread count, filter options, read/unread authorization, safe payload shape and route denial for client users.

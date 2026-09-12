# Module: Platform Operations

## Purpose

Owns reliability primitives: AuditEvent, idempotency, transactional outbox, pg-boss transport, JobRun, leases, RuntimeHeartbeat, retention and readiness.

## Not In Scope

Unregistered arbitrary jobs, Redis/broker, secrets/raw PII in payloads, HTTP inside DB transaction and infinite retry.

## Ownership

Models: `AuditEvent`, `IdempotencyKey`, `OutboxEvent`, `JobRun`, `RuntimeHeartbeat`, `RetentionRun`.

pg-boss is transport only; application tables remain delivery truth.

These records are platform-owned operational state. Tenant-related AuditEvent rows carry explicit product-local scope. Outbox/JobRun scope comes from the validated versioned payload and is never inferred from a generic organization foreign key.

## Principals

- Platform Admin: typed enqueue/retry and operations view.
- SEO Analyst: allowed sync actions.
- Job: handler execution with explicit organization scope.
- Internal worker lease identity: claim/complete/fail operations.

Tenant users do not access outbox/job detail.

## Lifecycle

```text
business transaction
→ IdempotencyKey + OutboxEvent + AuditEvent
→ outbox daemon claims event
→ pg-boss job with singletonKey = outboxEventId
→ handler reads job.data.event
→ JobRun attempt
→ complete / retry / dead-letter
```

## Invariants

- Same idempotency key + same hash returns original event.
- Same key + different hash conflicts.
- Research AuditEvent always stores `productCode = tools`, `organizationId` and `projectId`.
- Research OutboxEvent remains platform-owned; its payload names the exact Tools organization/project and the handler revalidates them.
- Only lease owner completes/fails.
- Retry is bounded exponential backoff, capped at five attempts.
- Permanent/invalid payload goes to dead-letter.
- pg-boss runtime does not run schema DDL.
- Successful `send()` completes dispatch even if duplicate returns null.
- Readiness uses persistent `RuntimeHeartbeat`, not sync timestamps.
- Retention deletes only old processed/dead-letter detail.

## Commands

```bash
pnpm worker:outbox:drain
pnpm worker:outbox:retention
pnpm pgboss:migrate
```

## Tests

Atomic counts, duplicate/conflict, lease ownership, retry/backoff, dead-letter, JobRun attempts, retention, readiness and clean pg-boss migration path.

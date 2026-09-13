# ADR-001: AMS IMPULSE Platform Profile

## Status

Accepted and amended by ADR-002 and ADR-003.

## Context

AMS IMPULSE combines public SEO marketing, private multi-tenant reporting, Platform Admin and scheduled provider integrations. The project needs tenant isolation, audited admin operations, repeatable external work and limited account/operational PII handling.

## Decision

- Platform contract: `AMS Application Platform Core 4.0 — Solo Minimal`.
- `TENANCY = multi-tenant`.
- `ASYNC = outbox-plus-queue`.
- `DATA = pii`.
- `DELIVERY = own-saas`.
- `PLATFORM_ADMIN = enabled`.
- `DATABASE = managed-postgresql`; production moved to Timeweb Managed PostgreSQL 18 on `2026-09-11`.
- Runtime keeps strict TypeScript `6.0.x` as an approved project version exception; exact `6.0.3` compatibility was verified against the installed stack on `2026-09-12` and remains lockfile-owned.
- Architecture is one modular monolith on Next.js with separate web/worker processes from one immutable OCI image.
- Data owner is PostgreSQL + Prisma; no second ORM/runtime store.
- Auth owner is Better Auth for identity/password/session and AMS for Membership/permissions/resource authorization.
- Mutations use `defineAction/API/job adapter → defineCommand → transaction-bound repositories`.
- Async uses transactional OutboxEvent → pg-boss → idempotent handler.
- Public site and private cabinet keep separate design systems.
- Opaque CUID identifiers are preserved.

## Consequences

- `PrincipalContext`, tenant-aware repositories and PostgreSQL constraints jointly protect tenant data.
- Platform Admin has no fake tenant.
- Отсутствие дополнительного фактора является временным незакрытым отклонением, а не постоянным owner exception. Целевой contract для `PLATFORM_ADMIN` — verified TOTP и безопасное recovery material.
- Applied migrations are immutable; production uses only `prisma migrate deploy`.
- Release is tied to exact reviewed SHA and immutable image digest.
- The previous self-managed PostgreSQL 18 remains read-only only for the approved rollback window through `2026-09-25`.
- Target database topology and rollback are fixed in ADR-003.

## Reconsider When

Review this ADR only if platform profile, auth/data owner, async mechanism, production topology or service boundary changes.

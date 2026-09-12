# DATA MODEL

Этот документ - единственный data/lifecycle source of truth. Фактическую структуру определяют `prisma/schema.prisma` и immutable `prisma/migrations/*`.

## Schema Policy

- Applied migration never changes.
- Production uses `prisma migrate deploy`; `db push` is forbidden.
- Queryable ownership and authorization fields stay relational.
- Cross-product generic foreign keys are prohibited.
- Runtime, worker, migrator and backup DB identities are separate.
- Current single-schema SEO model migrates incrementally without data loss.

## Platform Identity

Better Auth owns `User`, `Session`, `Account`, `Verification`. AMS owns authorization records and AuditEvent.

Target system roles:

- `PLATFORM_ADMIN`;
- `ANALYST`;
- `CLIENT`.

`PrincipalContext` is not persisted. It contains fresh identity/system role/correlation data and never chooses the first membership as active tenant.

## Product Access

Each product uses its own typed access tables. Current implementation status:

```text
SEO Monitor: Member          -> SeoProjectAccess       implemented in public
AMS Leads:    LeadsMembership -> LeadsProjectAccess    reserved, not implemented
Tools:        ToolsMembership -> ToolsProjectAccess    implemented in tools
```

Common invariants:

- one membership per user/organization/product;
- one explicit grant per membership/project;
- project belongs to the same product organization as membership;
- membership without project grant cannot read project data;
- no wildcard for future projects in v1;
- revoking membership cascades or disables its project grants atomically;
- grants have version and timestamps for optimistic concurrency/audit.

Product roles: `VIEWER`, `OPERATOR`, `ANALYST`. Role-to-permission mapping is code-owned and versioned, not editable arbitrary JSON.

## Product Ownership

### SEO Monitor

```text
SeoOrganization
-> SeoProject
-> Site
-> Provider configuration/evidence
-> ReportSnapshot
```

Existing `Organization`, `Member`, `Project`, `Site` are migrated behind SEO facades. Existing client visibility is converted to grants for exactly the projects previously visible.

### AMS Leads

```text
LeadsOrganization
-> LeadsProject
-> Funnel
-> Lead
```

Leads data model is reserved, not implemented in Research cycle.

Retention target: active leads remain; contact PII is removed six months after closure/last activity; aggregates remain 24 months. Exact lifecycle is finalized with Leads module.

### Tools

```text
ToolsOrganization
-> ToolsProject
-> Research / Contract / Invoice / Presentation / SiteClone
```

Implemented and future internal tools reference `ToolsProject`. They do not create parallel organization/project tables.

## Research Ownership

### Research

- `id`, `organizationId`, `projectId`;
- title, brief, status, author, version;
- created/updated/archived timestamps.

### ResearchQuery

- original text;
- stable order;
- unique position within Research.

### ResearchRun

- research scope and query count;
- estimate, expiry, approved and actual cost in kopecks;
- idempotency key, confirmation actor/time;
- lifecycle timestamps and safe error code.

### ResearchQueryRun

- one query execution within a run;
- query relation, attempt count, cost, safe error code and timestamps.

### Evidence And Output

- `Evidence` - normalized type, URL, title, snippet and bounded JSON payload;
- `CompetitorProjection` - deterministic aggregate by domain;
- `Export` - status, format, idempotency key, expiry and private object key;
- `ResearchInsight` - future, not implemented.

Raw provider XML/HTML and credentials are not stored by default.

## Research Lifecycle

```text
AWAITING_CONFIRMATION -> QUEUED -> RUNNING -> SUCCEEDED | FAILED
```

- `null != 0`.
- Run estimate is immutable after confirmation.
- Retry increments query attempt state and never follows an ambiguous timeout.
- Same organization/idempotency key cannot create a second run or export.
- Re-run creates a new ResearchRun.

## Budget

- maximum 20 queries per ResearchRun in pilot;
- daily approved ceiling 500 RUB;
- monthly approved ceiling 3000 RUB;
- paid execution requires current permission and unexpired exact confirmation;
- per-query configured estimate and actual collected cost are stored;
- actual provider invoice is not claimed unless provider exposes verifiable billing evidence.

## Tenant And Database Invariants

- Every tenant record carries product-local organization/project ownership.
- Composite foreign keys reject cross-organization parent relations.
- Resource lookup includes authorized product/project scope.
- RLS is fail-closed when transaction context is absent.
- Platform Admin does not receive a fake tenant record.
- IDs from browser/API/MCP do not establish ownership.
- Foreign resource returns not-found semantics without existence disclosure.

## Operations

AuditEvent, Outbox, idempotency, JobRun, RuntimeHeartbeat and pg-boss are platform-owned operational records, not product-owned business rows. A tenant-related AuditEvent carries explicit `productCode`, product-local `organizationId` and, where applicable, `projectId`; Research audit rows require the complete Tools scope. Because product organization registries are intentionally independent, this contextual audit reference is not a foreign key to the SEO-only `public.Organization` table.

Outbox delivery scope is the validated, versioned product payload. The legacy nullable `OutboxEvent.organizationId` is not authorization input and is not populated with a Tools organization ID. Product handlers must validate payload ownership before accessing data.

Research queue topic: `research.run.v1`, concurrency `1`, finite retry and dead-letter behavior.

## DateTime Policy

- proven UTC instants use `timestamptz(3)`;
- civil/business period keys use explicit `timestamp(3)` semantics;
- every new DateTime field declares its category;
- blind timezone conversion is prohibited.

## Backup And Retention

- Managed PostgreSQL physical backups: daily, at least 7 copies.
- Independent custom-format logical dump to private S3.
- Restore smoke before risky production migration.
- Provider physical backups remain the complete recovery source after `FORCE RLS`; the logical backup fails closed if its read-only identity cannot see all rows.
- Old self-managed database remains read-only for 14 days after cutover.
- Research/contracts/presentations retain history until explicit owner deletion policy.

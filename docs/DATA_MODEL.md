# DATA MODEL

Этот документ - единственный data/lifecycle source of truth. Фактическую структуру определяют `prisma/schema.prisma` и immutable `prisma/migrations/*`.

## Schema Policy

- Applied migration never changes.
- Production uses `prisma migrate deploy`; `db push` is forbidden.
- `pnpm verify:migrations` rejects edited/deleted/unregistered migrations, duplicate timestamp identifiers, a production-capable `db push` script and build paths that omit explicit Prisma generation.
- Queryable ownership and authorization fields stay relational.
- Cross-product generic foreign keys are prohibited.
- Runtime, worker, migrator and backup DB identities are separate.
- Current single-schema SEO model migrates incrementally without data loss.

### Schema ownership registry

One database object has exactly one migration and runtime owner:

| Schema / objects | Owner | Change path |
| --- | --- | --- |
| `public` AMS product, authorization and operations tables | Prisma / AMS | `prisma/schema.prisma` plus Prisma migrations |
| `public.User`, `Session`, `Account`, `Verification`, `Jwks`, `Oauth*` identity fields | Better Auth and its official plugins | generated library contract reviewed first, then an immutable Prisma migration |
| `research.*` | Research module / AMS SQL | immutable handwritten migrations plus typed Research repositories |
| `tools.*` | Tools Workspace module / AMS SQL | immutable handwritten migrations plus typed Tools repositories |
| `pgboss.*` | pg-boss | `scripts/pgboss-migrate.mjs`; application migrations do not edit its objects |
| `platform.*` functions and RLS helpers | Platform / AMS SQL | immutable handwritten migrations; only platform infrastructure calls them |
| reserved `seo`, `leads`, `contracts`, `invoices`, `presentations`, `site_clone`, `ops` | future owning module | no runtime tables until a module contract assigns ownership |

Prisma introspection, Better Auth startup and pg-boss startup must not create or
alter objects owned by another row. Ownership transfer requires an ADR and one
explicit migration; dual ownership is prohibited.

### SQL-owned product boundary

Research and Tools use the SQL-owned model (Option A). Prisma `multiSchema` is
not enabled for these domains: it would duplicate an already small, explicit SQL
surface and would couple Prisma generation to modules whose repositories use
parameterized `pg` queries. For a solo owner with AI assistance, the simpler
maintenance contract is:

- migrations define tables, composite constraints, indexes, RLS and grants;
- module repositories expose typed inputs/results and are the only product-code SQL boundary;
- application and UI code import module entrypoints, never raw table names;
- PostgreSQL integration checks verify schema shape, tenant constraints and RLS;
- a move to Prisma ownership is allowed only as an explicit, all-at-once ownership transfer.

This decision applies only to `research` and `tools`. It does not permit ad-hoc
SQL for Prisma-owned `public` models.

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
- estimate, expiry, approved amount and allocated conservative cost in kopecks;
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
- Browser estimate keys are derived from research ID + version + normalized queries; CSV keys are derived from run ID + format schema version. Same organization/key/input returns the existing run or export, while the same key with different material input fails with `RESEARCH_IDEMPOTENCY_CONFLICT`.
- Re-run creates a new ResearchRun.

## Budget

- maximum 20 queries per ResearchRun in pilot;
- daily approved ceiling 500 RUB;
- monthly approved ceiling 3000 RUB;
- persisted AMS money is a non-negative safe integer in minor units (`*Kopecks` for RUB); binary floating-point values and decimal rubles are not money storage;
- Research v1 is RUB-only, so currency is fixed by the module contract; any multi-currency record must persist an ISO 4217 currency code beside the integer amount;
- an external provider quote may retain its provider precision with an explicit currency, but it must be converted once at a named boundary before entering AMS budget arithmetic;
- allocation uses integer quotient plus deterministic remainder distribution, and allocated parts must sum exactly to the approved amount;
- paid execution requires current permission and unexpired exact confirmation;
- per-query configured estimate and actual collected cost are stored;
- actual provider invoice is not claimed unless provider exposes verifiable billing evidence.

Budget amount semantics are explicit: unexpired `AWAITING_CONFIRMATION` reserves estimated cost; `QUEUED/RUNNING` reserve approved cost; terminal `SUCCEEDED/FAILED` contribute actual query spend; `CANCELLED` contributes zero. Before a new budget calculation, expired estimates transition to `CANCELLED` with safe code `RESEARCH_ESTIMATE_EXPIRED` and no longer reserve funds.

## Tenant And Database Invariants

- Every tenant record carries product-local organization/project ownership.
- Composite foreign keys reject cross-organization parent relations.
- Research execution and export relations carry `organizationId`, `projectId`, and `researchId`; valid IDs from different Research aggregates cannot be combined.
- Resource lookup includes authorized product/project scope.
- RLS is fail-closed when transaction context is absent.
- Platform Admin does not receive a fake tenant record.
- IDs from browser/API/MCP do not establish ownership.
- Foreign resource returns not-found semantics without existence disclosure.

## Optimistic Concurrency

Important owner-edited state uses an integer `version` supplied by the caller and
matched in the write predicate. A successful mutation increments it; zero updated
rows maps to the common stale-state conflict. This applies to access grants,
organizations, Projects, Sites, Research, editable settings and provider
connections. Provider execution state machines additionally compare the expected
current status when claiming or completing an operation. Blind read-then-write and
unversioned replacement of settings are prohibited.

## Operations

AuditEvent, Outbox, idempotency, JobRun, RuntimeHeartbeat and pg-boss are platform-owned operational records, not product-owned business rows. A tenant-related AuditEvent carries explicit `productCode`, product-local `organizationId` and, where applicable, `projectId`; Research audit rows require the complete Tools scope. Because product organization registries are intentionally independent, this contextual audit reference is not a foreign key to the SEO-only `public.Organization` table.

Outbox delivery scope is the validated, versioned product payload. The legacy nullable `OutboxEvent.organizationId` is not authorization input and is not populated with a Tools organization ID. Product handlers must validate payload ownership before accessing data.

Research queue topic: `research.run.v1`, concurrency `1`, finite retry and dead-letter behavior.

Operational indexes follow repository predicates, not anticipated features. The
current evidence set covers tenant/project lists ordered by update time, Research
run history, budget windows, estimate expiry, per-run query execution, evidence
report ordering, outbox claim/reclaim, job status and notification audience/time.
New indexes require a concrete query path and should be validated with PostgreSQL
query plans when production-like volume is available.

## DateTime Policy

- proven UTC instants use `timestamptz(3)`;
- civil/business period keys use explicit `timestamp(3)` semantics;
- every new DateTime field declares its category;
- blind timezone conversion is prohibited.
- `research` and `tools` columns ending in `At` are application-owned UTC instants and are checked through `information_schema` by `scripts/verify-datetime-contract.mjs`;
- every application, worker, migration, maintenance, test, and release database session sets `TimeZone=UTC`; the DateTime contract check fails closed when the session differs;
- Research daily and monthly money limits use calendar boundaries at `00:00:00 UTC`, calculated only by `platform.research_budget_boundaries` so reservation and aggregation cannot disagree at a day or month rollover;
- `Run.allocatedCostKopecks` and `QueryRun.allocatedCostKopecks` are allocations of the approved conservative estimate across dispatched provider operations. They protect the internal budget but are not evidence of the exact XMLRiver invoice; a future provider reconciliation may introduce a separate factual cost field only when supported by provider billing evidence;
- Better Auth and OAuth timestamps in `public` remain library-managed and are excluded from bulk conversion; a library-contract review is required before changing them.

## Identifier Policy

Historical identifiers are not rewritten. New AMS-owned domain records use UUIDv7
from `src/platform/identifiers/new-id.ts`, giving opaque identifiers with a
time-sortable prefix and strong random entropy. Correlation IDs, idempotency keys
and Better Auth/library-owned identifiers are separate protocols and may retain
their own generators. Repository infrastructure for migrated AMS domains must not
call `randomUUID()` or `gen_random_uuid()` directly; the architecture guard
enforces that boundary.

## Backup And Retention

- Managed PostgreSQL physical backups: daily, at least 7 copies.
- Independent custom-format logical dump to private S3.
- Restore smoke before risky production migration.
- Provider physical backups remain the complete recovery source after `FORCE RLS`; the logical backup fails closed if its read-only identity cannot see all rows.
- Old self-managed database remains read-only for 14 days after cutover.
- Research/contracts/presentations retain history until explicit owner deletion policy.

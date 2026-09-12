# Module: Tools Workspace

## Purpose

Owns the shared `ToolsOrganization -> ToolsProject` workspace and explicit project grants used by Research and future Tools modules. It never reuses SEO organizations/projects as a substitute.

## Data Ownership

- `tools.ToolsOrganization`
- `tools.ToolsProject`
- `tools.ToolsMembership`
- `tools.ToolsProjectAccess`

Each project belongs to one Tools organization. Tool-owned records store the same product-local `organizationId` and `projectId`; composite PostgreSQL constraints and RLS protect that relationship.

## Commands / Queries

Queries:

- list Platform Admin organizations;
- list only explicitly accessible projects/options;
- resolve an exact server-owned organization/project pair from fresh options.

Commands:

- create/update Tools organization;
- create/update/archive Tools project;
- grant explicit Tools project access.

Structural commands are Platform Admin-only. Optimistic version conflicts return `TOOLS_RECORD_STALE`.

## Invariants

- Organization membership alone never grants project access.
- A requested URL/form organization-project pair is not authorization input until `resolveProjectScope` matches it against fresh accessible options.
- Archived projects are not silently reassigned or substituted.
- Research and future Tools modules reference this workspace through its root facade.

## Access / Tenancy

Platform Admin may administer workspace structure without a fake tenant. Tenant users see only project IDs returned by `AuthorizationService` for product `tools`. Repository reads/writes retain exact organization/project predicates; PostgreSQL RLS is defense in depth.

## Tests

- `tests/tools-workspace-service.test.ts`
- `tests/research-isolation.integration.test.ts`
- `tests/research-rls.integration.test.ts`
- `tests/tenant-constraints.integration.test.ts`

# ADR-004: Better Auth Account Schema Transition

- Status: `ACCEPTED / NOT IMPLEMENTED`
- Date: `2026-09-15`
- Risk: `RISKY`

## Context

AMS IMPULSE is pinned to Better Auth `1.7.2` and the aligned official packages. Its
Prisma model and applied PostgreSQL schema contain required `Account.issuer` and the
unique key `(issuer, accountId)`. Project credential writers also call
`createLocalAccountIssuer("credential")`.

Better Auth `1.7.0` through `1.7.2` introduced that account identity shape. Better Auth
`1.7.3` restored the 1.6-compatible `(providerId, accountId)` identity and stopped
requiring or writing `issuer`. The official upgrade guide says databases that already
applied the issuer schema must remove the issuer unique index and make `issuer` nullable
or remove it before deploying the newer runtime; the library migration command does not
perform this cleanup automatically.

Primary evidence:

- [Better Auth 1.7 upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide)
- [Better Auth 1.7 account-schema postmortem](https://better-auth.com/blog/1-7-account-schema)
- [Better Auth changelog](https://better-auth.com/changelog)

Read-only production preflight on `2026-09-15` found 9 accounts, all with
`providerId = credential`; there were no non-credential accounts, blank/null issuers,
duplicate `(providerId, accountId)` groups or duplicate `(issuer, accountId)` groups.
Catalog inspection confirmed `issuer NOT NULL` and the unique
`Account_issuer_accountId_key`. Only aggregates and index metadata were observed; account
identifiers, user identifiers, issuer values, PII and credentials were not returned.

## Decision

The project remains on exact `1.7.2` in this stream. A move to `1.7.3` or later is not a
routine dependency update: it requires a separate reviewed migration stream and one
exact-head RISKY gate. All Better Auth packages must move to one verified compatible
version together; no mixed-version rollout is allowed.

The first cleanup retains `Account.issuer` as nullable during the rollback window. It does
not drop the column in the same release. Permanent column removal, if still desired, is a
later migration after the rollback window and production evidence.

## Required Preflight

Before writing a migration:

1. Select one exact target version and generate its Better Auth/Prisma schema into a
   temporary review directory. Diff the complete auth and enabled-plugin schema against
   `prisma/schema.prisma`; do not infer it from semver.
2. Back up production and restore it into an isolated database. All migration and auth
   rehearsals run against that restore first.
3. Record aggregate counts only: total accounts, counts by `providerId`, blank/null
   `issuer`, duplicate groups for `(providerId, accountId)` and for `(issuer, accountId)`.
   Account identifiers and provider subjects must not enter logs or documents.
4. Stop if `(providerId, accountId)` duplicates exist. They require an explicit identity
   resolution decision; choosing an arbitrary row or deleting an account is forbidden.
5. Inventory every project use of `issuer`, `issuer_accountId` and
   `createLocalAccountIssuer`, including operator scripts, tests, OAuth/MCP flows and
   recovery tooling.

## Planned Migration And Cutover

The exact SQL is generated and reviewed only after the target version is selected. The
expected PostgreSQL transition is:

1. drop the current unique index on `(issuer, accountId)`;
2. make `issuer` nullable while retaining its values;
3. add the exact `(providerId, accountId)` uniqueness/index contract generated for the
   selected Better Auth version;
4. update the Prisma `Account` model and every issuer-dependent project writer/query in
   the same branch;
5. regenerate Prisma, apply the migration to the isolated restore and start the exact
   candidate image with Better Auth schema validation enabled;
6. prove username/password sign-in, invalid-password rejection, session lookup/revocation,
   password reset, TOTP enrollment/verification, Platform Admin recovery, MCP OAuth
   authorization-code + PKCE, token refresh and logout;
7. pause authentication and account-linking writes, take the release backup, apply the
   reviewed migration, deploy the immutable image, restart every web/worker instance and
   run the same focused live smoke before reopening writes.

Migration order is database compatibility first, then the new runtime. Deploying a runtime
that no longer writes `issuer` while the column is still `NOT NULL` is prohibited.

## Rollback Boundary

Before any new runtime has written an account with `issuer IS NULL`, rollback may restore
the prior index/constraint and the `1.7.2` image after proving every row still has a valid
issuer. Once a null-issuer account exists, package rollback alone is unsafe. Recovery then
requires either a reviewed deterministic issuer reconstruction for every affected provider
or restoration of the pre-cutover database plus reconciliation of writes performed after
the backup. The release remains paused until the owner accepts that data decision.

The retained nullable column and its values are the short-term rollback aid. They are not
proof that a reverse migration is safe.

## Acceptance And Cleanup

The future stream is accepted only with:

- zero unresolved `(providerId, accountId)` collisions;
- immutable migration registered in the migration manifest;
- exact-version schema diff reviewed;
- focused unit/integration auth tests and restored-database rehearsal passing;
- green exact-head SourceCraft RISKY gate;
- production migration status, auth/MCP live smoke and rollback evidence recorded without
  credentials or account identifiers.

Dropping `Account.issuer` is deferred to a separate cleanup after the rollback window. This
ADR authorizes planning only; it does not authorize the dependency upgrade, migration,
merge or production release.

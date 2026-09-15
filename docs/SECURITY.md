# SECURITY

Security boundary: `multi-tenant / pii / own-saas / Platform Admin enabled`.

## Core Rule

Authorization is deny-by-default. A user can act only when the server proves all required relationships:

```text
active identity
+ active product membership
+ explicit project grant
+ role permission
+ resource belongs to that project
= allow
```

Missing, stale or inconsistent evidence means deny.

## Identity

Better Auth `1.7.2` owns credentials and sessions. AMS owns system roles, product memberships, project grants, permissions, resource authorization and audit.

System roles:

- `PLATFORM_ADMIN` - only global bypass;
- `PLATFORM_ADMIN` authority is issued only after verified TOTP enrollment. The first
  administrator is created by the two-stage owner CLI bootstrap; the bootstrap closes
  permanently as soon as an administrator exists. Passwords and TOTP codes enter
  through stdin. Enrollment and one-time recovery material is written exclusively to a
  new owner-selected path outside the repository and must then be moved to offline storage.
- Platform Admin break-glass recovery is owner-CLI-only. A valid one-time recovery code
  revokes its complete batch and every active session, rotates TOTP and recovery material,
  writes an AuditEvent, and leaves admin authority denied until the new TOTP is verified.
  Better Auth backup codes are intentionally empty for bootstrapped Platform Admin accounts.
- A pre-TOTP legacy Platform Admin can be adopted exactly once by the owner CLI only when
  it is the sole active Platform Admin and has no TOTP or recovery records. Adoption rotates
  the password, revokes every session, creates pending TOTP plus offline recovery material,
  writes start/completion AuditEvents and keeps admin authority denied until TOTP verification.
- `ANALYST` - internal identity, explicit grants required;
- `CLIENT` - customer identity, explicit grants required.

The Better Auth principal factory never converts `systemRole = ANALYST` into a
global platform principal. An identity Analyst receives only project-scoped access
resolved from fresh product grants. The explicit `platform-analyst` principal is
reserved for trusted server composition and is not produced from a user database row.
Before a release that closes legacy aggregate Analyst access, production is checked
for Analysts without grants. They remain denied by default; no grant is created
automatically or inferred from the system role.

`PrincipalContext` contains identity/system role/correlation ID. Browser, URL, form, cookie, token claim or first membership never chooses tenant scope.

Public signup, user-created organizations, self-service role editing and arbitrary custom roles are disabled.

## Authorization Contract

```text
authorize(principal, permission, resourceRef)
-> ALLOW | DENY
```

`resourceRef` requires a known product and exact organization/project; optional resource identifiers refine that complete scope. Missing scope fails with `RESOURCE_SCOPE_REQUIRED`, and an unknown product fails with stable `UNKNOWN_PRODUCT` instead of dynamic indexing. Platform Admin uses the same explicit target requirement; privileged mutations record that target in AuditEvent. Authorization runs for every:

- private Server Component and route handler;
- server action and application command;
- API and export download;
- MCP tool call;
- worker job.

Navigation hiding is not authorization. Unknown or foreign resource returns safe not-found semantics. Error bodies and timing should not intentionally disclose whether a foreign ID exists.

## Product Isolation

- SEO grant never opens Leads or Tools.
- Leads grant never opens SEO or Tools.
- Tools grant never opens client products.
- Organization membership does not open every project.
- No access to future projects is inherited automatically.
- Product-specific access tables use real foreign keys; generic polymorphic grants are forbidden.
- Analyst receives no data solely from `ANALYST` system role.

Changing/revoking membership or project grant writes AuditEvent and revokes active Better Auth sessions. Effective access is rebuilt from database state on the next request.

## PostgreSQL Defense

Application authorization, scoped repositories and composite ownership constraints are mandatory. RLS adds defense in depth for tenant-owned runtime tables:

- `ENABLE ROW LEVEL SECURITY`;
- `FORCE ROW LEVEL SECURITY`, except documented definer lookup roots that remain protected for non-owner runtime roles;
- runtime roles use `NOBYPASSRLS` and do not own protected tables;
- transaction-local user/product/project context;
- no context means default deny;
- `USING` restricts reads/deletes and `WITH CHECK` restricts inserts/updates;
- web and worker roles cannot run DDL;
- migrator and backup identities are not used by application runtime;
- provider physical backups remain complete independently of RLS; logical backup aborts before upload when `FORCE RLS` exists and the provider-managed backup role cannot bypass it.

Every `defineCommand` transaction derives a discriminated database authorization context from the server-generated principal and installs it before application SQL runs. Supported context kinds are user, Platform Admin, API client and project-scoped job. Command payload fields never supply this context; an incomplete principal fails with `AUTHORIZATION_CONTEXT_REQUIRED`.

`JobPrincipal` always carries both `organizationId` and `projectId`; the type and
factory reject an incomplete project scope before a command can be composed. An
organization-scoped outbox dispatcher passes its validated organization fields
directly to the bounded orchestration adapter and does not manufacture a project job
principal.

RLS changes require PostgreSQL integration tests proving allowed and denied reads/writes. Backup proof verifies complete dump and restore independently from runtime policies.

Protected-table policy matrix:

| Tables | ENABLE / FORCE | `USING` and `WITH CHECK` | Context |
| --- | --- | --- | --- |
| `Project`, `SyncRun` | yes / yes | exact SEO organization + project | user or project-scoped worker |
| `Site` | yes / no | authorized SEO project; definer lookup root | user or project-scoped worker |
| `ProviderOperation`, `ProviderConnection`, `SearchTarget`, `GoalDefinitionSite`, `TrackedQuerySet`, `SourceRun`, all Webmaster/Metrika daily metric tables, `LandingPageDailyMetric`, `CompetitorSnapshot`, `TechnicalSnapshot`, `ReportSnapshot` | yes / yes | authorized parent site/project | user or project-scoped worker |
| `GoalDefinition` | yes / yes | exact SEO organization + project | user or project-scoped worker |
| `TrackedQuery`, `RankingCapture` | yes / yes | authorized tenant parent relation | user or project-scoped worker |
| `Notification` | yes / yes | non-null authorized project | user or project-scoped worker |
| `SeoProjectAccess` | yes / no | tenant-scoped SELECT; Platform Admin INSERT/UPDATE/DELETE; definer lookup root | user |
| `ToolsOrganization` | yes / yes | tenant-scoped SELECT; Platform Admin INSERT/UPDATE/DELETE | user |
| `ToolsMembership`, `ToolsProjectAccess` | yes / no | tenant-scoped SELECT; Platform Admin INSERT/UPDATE/DELETE; definer lookup roots | user |
| `ToolsProject`, `research.Research`, `research.Query`, `research.Run`, `research.QueryRun`, `research.Evidence`, `research.CompetitorProjection`, `research.Export` | yes / yes | exact Tools organization + project | user or project-scoped worker |

The migrator owns schema changes. `ams_web` and `ams_worker` are login roles with `NOBYPASSRLS`, no role inheritance and no protected relation/schema ownership; `ops/postgres/roles.sql` verifies these facts before applying grants. User context is `ams.user_id`; worker context is the pair `ams.job_organization_id` + `ams.job_project_id`. No context denies restricted runtime access.

`Member`, `Site`, `SeoProjectAccess`, `ToolsMembership` and `ToolsProjectAccess` deliberately use ENABLE without FORCE because they are lookup inputs to tightly scoped `SECURITY DEFINER` authorization functions. PostgreSQL applies FORCE policies to a table owner; keeping FORCE here would recursively re-enter the same policy. The exception does not exempt runtime identities: they are verified non-owners with `NOBYPASSRLS`. Definer functions use fixed trusted `search_path` values ending in `pg_temp` and expose only boolean decisions.

The live database coverage guard discovers every table with `organizationId`. Product tables must have ENABLE and FORCE RLS plus an authorization-function policy. The five authorization lookup relations must have ENABLE RLS, remain non-FORCE, be owned outside runtime roles and retain authorization policies. `AuditEvent`, `IdempotencyKey`, `OutboxEvent` and `JobRun` are explicit platform-operational exceptions: they coordinate cross-tenant audit, commands and queue dispatch before a product context is available, and are reachable only through authorized platform repositories. New or unclassified tables fail the guard by default.

`PUBLIC` has neither `USAGE` on schema `platform` nor execution on authorization
`SECURITY DEFINER` helpers. `ams_web` and `ams_worker` receive explicit schema
usage plus only the exact function grants required by their RLS policies;
stale-run scope discovery is worker-only. Budget boundaries are evaluated in UTC.

## Browser And UI

- Server builds navigation from effective product access.
- Organization/project selectors receive only authorized options.
- Research URL and form IDs are requested selections only; the server resolves an exact pair from fresh Tools project options before calling the application service.
- Client-side permission checks improve UX only.
- Private responses use `Cache-Control: no-store` where relevant.
- Service worker intercepts only immutable `/_next/static/*` assets and exact PWA icon/favicon paths without query, cookie or authorization headers. It cannot cache navigation, session, API, MCP, OAuth, report, export, research or PII responses.
- Logout performs a hard public navigation; a private shell restored from BFCache is reloaded and reauthorized. Offline navigation to a private route has no service-worker response.
- Private S3 object keys are never public and are bound to the exact Tools organization, project, research and export id. Download URLs are HTTPS-only, contain no URL credentials, are capped at 60 seconds and are issued only after fresh `research:export` authorization.

### Public Lead Form

- The form collects only name, phone, source/UTM context and anti-spam fields required by the AMS Leads API.
- Submission requires explicit consent for responding to the request and links both the privacy policy and consent document.
- The request records consent time, scope and document paths in lead metadata.
- Browser PII is sent only to the exact allowlisted `https://ams24.ru/api/leads` endpoint. Invalid public configuration fails before `fetch`.
- This repository does not persist public lead PII. Downstream storage, access, deletion and the documented three-year retention period belong to the AMS Leads API contract and require independent operational proof.
- The current public runtime does not install analytics or marketing cookies. Enabling them requires a separately reviewed consent control and an update of the published cookie text before activation.

## MCP

- Production transport uses OAuth 2.1 + PKCE.
- Remote clients use bounded CIMD discovery: HTTPS metadata URLs only, no query,
  credentials, fragments or non-standard ports; metadata and JWKS policy URLs remain
  origin-bound; fetch concurrency, per-origin rate and cache size/TTL are capped.
- Unauthenticated Dynamic Client Registration is disabled. CIMD or explicit
  pre-registration is the supported client identity path.
- Self-asserted `software_id`, `software_version` and `software_statement`
  metadata is rejected unless a future separately reviewed verifier is introduced.
- Browser-origin MCP requests require the canonical origin and same-origin Fetch Metadata.
  Native/server clients remain valid without browser-only headers. Authenticated requests
  are rate-limited per hashed OAuth subject in a shared PostgreSQL window.
- Access token subject maps to Better Auth user.
- Token scopes may narrow but cannot expand current AMS grants.
- Authorization is re-evaluated on every tool call.
- No browser cookie, universal admin bearer token, generic SQL or direct database tool.
- Paid tool requires a persisted estimate, matching confirmation amount and idempotency key.
- Tool outputs are bounded and redact provider/internal errors.

## Worker And Providers

- JobPrincipal contains exact product, organization, project and job identity.
- Handler verifies payload ownership before data access.
- Provider secrets exist only server-side.
- XMLRiver full URL/query credential/raw response is never logged.
- XML parser disables DTD/external entities and applies response-size limits.
- External call runs outside DB transaction.
- Paid run is reserved durably before queue dispatch.
- Ambiguous paid result becomes `FAILED` with a safe code, never automatic retry.

Research worker sets transaction-local `ams.job_organization_id` and `ams.job_project_id`. RLS allows `ams_worker` only rows matching both values from the validated queue payload.

Notification RLS distinguishes project, organization and global scope. Project rows require a fresh SEO project grant; organization rows require membership in that organization; global and `PLATFORM_ADMIN_ONLY` rows are visible only to Platform Admin. A scoped worker may write project or organization lifecycle notifications only for its transaction-local organization, while `NotificationRead` is restricted to the current user's own rows and visible notifications.

## Passwords And Sessions

Passwords and hashes never enter Git, docs, argv, logs or AuditEvent. Password reset,
access change and user disable revoke sessions. Platform Admin additionally requires a
verified TOTP second factor; there is no password-only owner exception.

Production web listens only on loopback behind host Nginx. Nginx overwrites both client-IP
headers with its direct peer address; Better Auth reads only `X-Real-IP` and trusts only the
configured loopback proxy hop. Client-supplied forwarded chains never select a rate-limit or
session IP identity.

Better Auth stores rate-limit counters in PostgreSQL so limits survive process restarts and
apply consistently across web replicas. Sign-in is limited to five attempts per minute;
password change, password reset and two-factor verification use stricter five-minute windows;
the OAuth token endpoint is limited to ten requests per minute. The global `RateLimit` key
contains the normalized client IP and auth path, so it is treated as short-lived security
metadata: only `ams_web` may mutate it, `ams_worker` has no access, and expired rows are pruned
by Better Auth when rate-limit windows roll over. It is not used for analytics or tenant access.

Next is the single owner of the response CSP; Nginx does not append a second policy.
Public and private application routes enforce a Next 16-compatible CSP: same-origin
defaults, fonts and forms; only local/data/blob images and local/blob workers; no
objects, foreign base URI or framing. Only the public landing route may connect to the
external AMS Leads endpoint; private routes remain `connect-src 'self'`. The current
non-nonce baseline retains `unsafe-inline` only for framework scripts/styles under the
`Framework CSP inline bootstrap` exception in `docs/PLATFORM_CONFORMANCE.md`. It must
be removed after a report-only measurement shows no required inline violations and the
official request-proxy nonce flow is accepted together with fully dynamic rendering
instead of static/PPR output.

Next.js and Nginx both provide HSTS, MIME sniffing protection, strict-origin
referrer policy and bounded browser permissions. Next explicitly disables camera,
microphone, geolocation, payment, USB and interest-cohort capabilities, owns opener
isolation and the route-aware CSP. The public lead endpoint is the only external
browser connection allowed by application CSP. Regression proof resolves final
Next response headers for `/`, `/dashboard` and `/sw.js`, not only config text.

## PII, Secrets And Logging

- PII is limited to required identity/product records.
- Production PII is prohibited in fixtures.
- Secrets come from approved Doppler scope/protected server environment.
- Server secrets never use `NEXT_PUBLIC_*`.
- Logs contain safe IDs/counts/status/correlation only.
- Passwords, tokens, cookies, API keys, emails, phones, raw payloads and signed URLs are redacted.
- Public errors contain stable code, safe message and correlation ID.
- `/demo` contains synthetic fixtures and is accessible only to a server-authorized
  Platform Admin; an ordinary authenticated customer is redirected before data rendering.
- Auth/callback responses, MCP, consent, fixtures, private workspaces, exports, signed
  downloads and their error/redirect responses use `no-store` cache policy.

## Required Access Matrix

Tests must prove:

- SEO-only, Leads-only, SEO+Leads and Tools-only navigation/data behavior;
- project A cannot read project B in same organization;
- tenant A cannot read/write tenant B;
- guessed IDs fail in route/action/API/MCP;
- direct server action invocation fails without access;
- revoked/disabled user loses web and MCP access;
- analyst has only explicit grants;
- RLS denies missing context and cross-tenant inserts/updates;
- backup includes all tenant rows;
- logs/errors reveal no foreign resource or secret data.

## Delivery

Auth, tenancy, RLS, MCP, paid provider, PII and schema changes are `RISKY`. Merge requires diff review, scoped tests, PostgreSQL integration proof and green SourceCraft exact-head gate. Production additionally requires backup/restore, migration and live access smoke after an explicit owner command.

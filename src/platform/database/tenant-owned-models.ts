export const TENANT_OWNED_MODELS = [
  "Project",
  "Site",
  "ProviderConnection",
  "GoalDefinition",
  "GoalDefinitionSite",
  "TrackedQuerySet",
  "TrackedQuery",
  "RankingCapture",
  "SearchTarget",
  "ProviderOperation",
  "CompetitorSnapshot",
  "SyncRun",
  "SourceRun",
  "WebmasterDailyMetric",
  "WebmasterQueryDailyMetric",
  "MetrikaDailyMetric",
  "LandingPageDailyMetric",
  "MetrikaDeviceDailyMetric",
  "MetrikaGoalDailyMetric",
  "MetrikaSearchEngineDailyMetric",
  "MetrikaSearchPhraseDailyMetric",
  "MetrikaGeoDailyMetric",
  "TechnicalSnapshot",
  "ReportSnapshot",
  "Notification",
] as const;

export const APPLICATION_OWNED_SCHEMAS = [
  "public",
  "seo",
  "leads",
  "tools",
  "research",
  "contracts",
  "invoices",
  "presentations",
  "site_clone",
  "ops",
] as const;

export const EXTERNAL_OWNED_SCHEMAS = {
  pgboss: "pg-boss owns its queue schema and timestamp contract",
  platform: "AMS platform owns functions and RLS helpers, not application records",
} as const;

export const DATETIME_CONTRACT_EXEMPT_COLUMNS = {
  "public.User.createdAt": "Better Auth owns the User lifecycle timestamp mapping",
  "public.User.updatedAt": "Better Auth owns the User lifecycle timestamp mapping",
  "public.Session.expiresAt": "Better Auth owns the Session lifecycle timestamp mapping",
  "public.Session.createdAt": "Better Auth owns the Session lifecycle timestamp mapping",
  "public.Session.updatedAt": "Better Auth owns the Session lifecycle timestamp mapping",
  "public.jwks.createdAt": "Better Auth JWT owns the JWK lifecycle timestamp mapping",
  "public.jwks.expiresAt": "Better Auth JWT owns the JWK lifecycle timestamp mapping",
  "public.oauthClient.createdAt": "Better Auth OAuth owns the client timestamp mapping",
  "public.oauthClient.updatedAt": "Better Auth OAuth owns the client timestamp mapping",
  "public.oauthResource.createdAt": "Better Auth OAuth owns the resource timestamp mapping",
  "public.oauthResource.updatedAt": "Better Auth OAuth owns the resource timestamp mapping",
  "public.oauthClientResource.createdAt": "Better Auth OAuth owns the client-resource timestamp mapping",
  "public.oauthRefreshToken.expiresAt": "Better Auth OAuth owns the refresh-token timestamp mapping",
  "public.oauthRefreshToken.createdAt": "Better Auth OAuth owns the refresh-token timestamp mapping",
  "public.oauthRefreshToken.rotatedAt": "Better Auth OAuth owns the refresh-token timestamp mapping",
  "public.oauthRefreshToken.rotationReplayExpiresAt": "Better Auth OAuth owns the refresh-token timestamp mapping",
  "public.oauthAccessToken.expiresAt": "Better Auth OAuth owns the access-token timestamp mapping",
  "public.oauthAccessToken.createdAt": "Better Auth OAuth owns the access-token timestamp mapping",
  "public.oauthConsent.createdAt": "Better Auth OAuth owns the consent timestamp mapping",
  "public.oauthConsent.updatedAt": "Better Auth OAuth owns the consent timestamp mapping",
  "public.oauthClientAssertion.expiresAt": "Better Auth OAuth owns the client-assertion timestamp mapping",
  "public.Account.accessTokenExpiresAt": "Better Auth owns the Account token timestamp mapping",
  "public.Account.refreshTokenExpiresAt": "Better Auth owns the Account token timestamp mapping",
  "public.Account.createdAt": "Better Auth owns the Account lifecycle timestamp mapping",
  "public.Account.updatedAt": "Better Auth owns the Account lifecycle timestamp mapping",
  "public.Verification.expiresAt": "Better Auth owns the Verification timestamp mapping",
  "public.Verification.createdAt": "Better Auth owns the Verification timestamp mapping",
  "public.Verification.updatedAt": "Better Auth owns the Verification timestamp mapping",
} as const;

export const PLATFORM_OPERATIONAL_MODELS = [
  "AuditEvent",
  "IdempotencyKey",
  "OutboxEvent",
  "JobRun",
  "RuntimeHeartbeat",
  "RetentionRun",
] as const;

export const RLS_AUTHORIZATION_LOOKUP_RELATIONS = [
  "public.Member",
  "public.Site",
  "public.SeoProjectAccess",
  "tools.ToolsMembership",
  "tools.ToolsProjectAccess",
] as const;

export const PROTECTED_RELATIONS = [
  { relation: "public.Member", tenancy: "lookup" },
  { relation: "public.Site", tenancy: "lookup" },
  { relation: "public.SeoProjectAccess", tenancy: "lookup" },
  { relation: "public.NotificationRead", tenancy: "user-owned" },
  { relation: "tools.ToolsOrganization", tenancy: "own-id" },
  { relation: "tools.ToolsMembership", tenancy: "lookup" },
  { relation: "tools.ToolsProjectAccess", tenancy: "lookup" },
] as const;

export type ProtectedRelation = (typeof PROTECTED_RELATIONS)[number];

export const PLATFORM_OPERATIONAL_RLS_EXEMPTIONS = {
  "public.AuditEvent": "cross-tenant append-only audit queried only through authorized platform operations",
  "public.IdempotencyKey": "command coordination state shared by platform transaction infrastructure",
  "public.OutboxEvent": "cross-tenant queue claimed by the worker dispatcher before project context exists",
  "public.JobRun": "cross-tenant worker lifecycle state linked to the platform outbox",
} as const;

export type TenantOwnedModel = (typeof TENANT_OWNED_MODELS)[number];

export function isTenantOwnedModel(model: string): model is TenantOwnedModel {
  return TENANT_OWNED_MODELS.some((candidate) => candidate === model);
}

export type PlatformOperationalModel = (typeof PLATFORM_OPERATIONAL_MODELS)[number];

export function isPlatformOperationalModel(model: string): model is PlatformOperationalModel {
  return PLATFORM_OPERATIONAL_MODELS.some((candidate) => candidate === model);
}

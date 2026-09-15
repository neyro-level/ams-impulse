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

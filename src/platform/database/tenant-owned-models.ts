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

export type TenantOwnedModel = (typeof TENANT_OWNED_MODELS)[number];

export function isTenantOwnedModel(model: string): model is TenantOwnedModel {
  return TENANT_OWNED_MODELS.some((candidate) => candidate === model);
}

export type PlatformOperationalModel = (typeof PLATFORM_OPERATIONAL_MODELS)[number];

export function isPlatformOperationalModel(model: string): model is PlatformOperationalModel {
  return PLATFORM_OPERATIONAL_MODELS.some((candidate) => candidate === model);
}

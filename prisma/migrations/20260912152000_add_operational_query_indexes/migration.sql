-- Outbox claim/reclaim predicates and their deterministic ordering.
DROP INDEX "public"."OutboxEvent_status_availableAt_idx";
DROP INDEX "public"."OutboxEvent_lockedAt_idx";
CREATE INDEX "OutboxEvent_status_availableAt_createdAt_idx"
  ON "public"."OutboxEvent"("status", "availableAt", "createdAt");
CREATE INDEX "OutboxEvent_status_lockedAt_idx"
  ON "public"."OutboxEvent"("status", "lockedAt");

-- Research execution and report access patterns present in typed repositories.
CREATE INDEX "Run_research_createdAt_idx"
  ON "research"."Run"("organizationId", "projectId", "researchId", "createdAt" DESC);
CREATE INDEX "Run_budget_status_confirmedAt_idx"
  ON "research"."Run"("organizationId", "projectId", "status", "confirmedAt");
CREATE INDEX "Run_estimate_status_expiresAt_idx"
  ON "research"."Run"("status", "estimateExpiresAt");
CREATE INDEX "QueryRun_run_status_idx"
  ON "research"."QueryRun"("runId", "status");
CREATE INDEX "Evidence_queryRun_collectedAt_idx"
  ON "research"."Evidence"("queryRunId", "collectedAt", "id");

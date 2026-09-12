CREATE OR REPLACE FUNCTION "platform"."research_committed_spend"(
  target_organization_id TEXT,
  authorized_project_id TEXT,
  reference_time TIMESTAMPTZ
)
RETURNS TABLE ("dailyKopecks" BIGINT, "monthlyKopecks" BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, tools, research, pg_catalog, pg_temp
AS $$
  WITH chargeable AS (
    SELECT
      CASE
        WHEN run."status" = 'AWAITING_CONFIRMATION'
          AND run."estimateExpiresAt" > reference_time
          THEN run."estimatedCostKopecks"
        WHEN run."status" IN ('QUEUED', 'RUNNING')
          THEN COALESCE(run."approvedCostKopecks", run."estimatedCostKopecks")
        WHEN run."status" IN ('SUCCEEDED', 'PARTIAL', 'FAILED')
          THEN COALESCE(run."actualCostKopecks", 0)
        ELSE 0
      END AS amount,
      COALESCE(run."confirmedAt", run."createdAt") AS committed_at
    FROM "research"."Run" AS run
    WHERE run."organizationId" = target_organization_id
      AND run."projectId" = authorized_project_id
      AND run."status" IN ('AWAITING_CONFIRMATION', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED')
      AND "platform"."can_access_tools_project"(target_organization_id, authorized_project_id)
  )
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE committed_at >= date_trunc('day', reference_time)), 0)::BIGINT,
    COALESCE(SUM(amount) FILTER (WHERE committed_at >= date_trunc('month', reference_time)), 0)::BIGINT
  FROM chargeable
$$;

REVOKE ALL ON FUNCTION "platform"."research_committed_spend"(TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "platform"."research_committed_spend"(TEXT, TEXT, TIMESTAMPTZ) TO PUBLIC;

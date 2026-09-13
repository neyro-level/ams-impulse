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
  WITH boundaries AS (
    SELECT
      date_trunc('day', reference_time AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS day_start,
      date_trunc('month', reference_time AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS month_start
  ), chargeable AS (
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
    COALESCE(SUM(amount) FILTER (WHERE committed_at >= boundaries.day_start), 0)::BIGINT,
    COALESCE(SUM(amount) FILTER (WHERE committed_at >= boundaries.month_start), 0)::BIGINT
  FROM chargeable CROSS JOIN boundaries
  GROUP BY boundaries.day_start, boundaries.month_start
$$;

CREATE OR REPLACE FUNCTION "platform"."enforce_terminal_research_run"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, research, pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW."status" IN ('SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED')
    AND EXISTS (
      SELECT 1
      FROM "research"."QueryRun" AS query_run
      WHERE query_run."runId" = NEW."id"
        AND query_run."status" IN ('PENDING', 'RUNNING')
    )
  THEN
    RAISE EXCEPTION 'terminal research run has nonterminal query runs'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS "Run_terminal_queries_guard" ON "research"."Run";
CREATE TRIGGER "Run_terminal_queries_guard"
BEFORE INSERT OR UPDATE OF "status" ON "research"."Run"
FOR EACH ROW
EXECUTE FUNCTION "platform"."enforce_terminal_research_run"();

REVOKE ALL ON FUNCTION "platform"."current_user_id"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "platform"."is_restricted_runtime"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "platform"."is_platform_admin"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "platform"."can_access_seo_project"(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION "platform"."can_access_seo_site"(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION "platform"."can_access_tools_project"(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION "platform"."worker_can_access_seo_project"(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION "platform"."worker_can_access_tools_project"(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION "platform"."research_committed_spend"(TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION "platform"."stale_research_run_scopes"(TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION "platform"."enforce_terminal_research_run"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "platform"."current_user_id"() TO ams_web, ams_worker;
GRANT EXECUTE ON FUNCTION "platform"."is_restricted_runtime"() TO ams_web, ams_worker;
GRANT EXECUTE ON FUNCTION "platform"."is_platform_admin"() TO ams_web;
GRANT EXECUTE ON FUNCTION "platform"."can_access_seo_project"(TEXT, TEXT) TO ams_web, ams_worker;
GRANT EXECUTE ON FUNCTION "platform"."can_access_seo_site"(TEXT, TEXT) TO ams_web, ams_worker;
GRANT EXECUTE ON FUNCTION "platform"."can_access_tools_project"(TEXT, TEXT) TO ams_web, ams_worker;
GRANT EXECUTE ON FUNCTION "platform"."worker_can_access_seo_project"(TEXT, TEXT) TO ams_web, ams_worker;
GRANT EXECUTE ON FUNCTION "platform"."worker_can_access_tools_project"(TEXT, TEXT) TO ams_web, ams_worker;
GRANT EXECUTE ON FUNCTION "platform"."research_committed_spend"(TEXT, TEXT, TIMESTAMPTZ) TO ams_web;
GRANT EXECUTE ON FUNCTION "platform"."stale_research_run_scopes"(TIMESTAMPTZ) TO ams_worker;

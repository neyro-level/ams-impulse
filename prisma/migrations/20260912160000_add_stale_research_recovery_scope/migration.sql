CREATE INDEX "Run_running_startedAt_idx"
  ON "research"."Run"("startedAt")
  WHERE "status" = 'RUNNING';

CREATE OR REPLACE FUNCTION "platform"."stale_research_run_scopes"(started_before timestamptz)
RETURNS TABLE("organizationId" TEXT, "projectId" TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, research
AS $$
  SELECT DISTINCT run."organizationId", run."projectId"
  FROM "research"."Run" AS run
  WHERE session_user = 'ams_worker'
    AND run."status" = 'RUNNING'
    AND run."startedAt" < started_before
$$;

REVOKE ALL ON FUNCTION "platform"."stale_research_run_scopes"(timestamptz) FROM PUBLIC;

CREATE OR REPLACE FUNCTION "platform"."is_restricted_runtime"()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT session_user IN ('ams_web', 'ams_worker')
$$;

CREATE OR REPLACE FUNCTION "platform"."can_access_seo_project"(
  target_organization_id TEXT,
  target_project_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, platform, pg_catalog, pg_temp
AS $$
  SELECT "platform"."worker_can_access_seo_project"(
    target_organization_id,
    target_project_id
  ) OR EXISTS (
    SELECT 1
    FROM "public"."User" AS app_user
    WHERE app_user.id = "platform"."current_user_id"()
      AND app_user."disabledAt" IS NULL
      AND (
        app_user."systemRole" = 'PLATFORM_ADMIN'::"public"."SystemRole"
        OR EXISTS (
          SELECT 1
          FROM "public"."Member" AS membership
          JOIN "public"."SeoProjectAccess" AS access
            ON access."membershipId" = membership.id
           AND access."organizationId" = membership."organizationId"
          WHERE membership."userId" = app_user.id
            AND access."organizationId" = target_organization_id
            AND access."projectId" = target_project_id
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION "platform"."can_access_seo_site"(
  target_organization_id TEXT,
  target_site_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, platform, pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "public"."Site" AS site
    WHERE site.id = target_site_id
      AND site."organizationId" = target_organization_id
      AND (
        "platform"."worker_can_access_seo_project"(site."organizationId", site."projectId")
        OR "platform"."can_access_seo_project"(site."organizationId", site."projectId")
      )
  )
$$;

CREATE OR REPLACE FUNCTION "platform"."can_access_tools_project"(
  target_organization_id TEXT,
  target_project_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, tools, platform, pg_catalog, pg_temp
AS $$
  SELECT "platform"."worker_can_access_tools_project"(
    target_organization_id,
    target_project_id
  ) OR EXISTS (
    SELECT 1
    FROM "public"."User" AS app_user
    WHERE app_user.id = "platform"."current_user_id"()
      AND app_user."disabledAt" IS NULL
      AND (
        app_user."systemRole" = 'PLATFORM_ADMIN'::"public"."SystemRole"
        OR EXISTS (
          SELECT 1
          FROM "tools"."ToolsMembership" AS membership
          JOIN "tools"."ToolsProjectAccess" AS access
            ON access."membershipId" = membership.id
           AND access."organizationId" = membership."organizationId"
          WHERE membership."userId" = app_user.id
            AND access."organizationId" = target_organization_id
            AND access."projectId" = target_project_id
        )
      )
  )
$$;

-- Stale-run discovery is intentionally worker-wide before a job scope exists.
-- Keep that exceptional authorization decision in a named worker predicate so
-- SECURITY DEFINER inventory can require an explicit authorization reference.
CREATE OR REPLACE FUNCTION "platform"."worker_can_access_research_recovery"()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT session_user = 'ams_worker'
$$;

CREATE OR REPLACE FUNCTION "platform"."stale_research_run_scopes"(started_before timestamptz)
RETURNS TABLE("organizationId" TEXT, "projectId" TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, research, platform, pg_temp
AS $$
  SELECT DISTINCT run."organizationId", run."projectId"
  FROM "research"."Run" AS run
  WHERE "platform"."worker_can_access_research_recovery"()
    AND run."status" = 'RUNNING'
    AND run."startedAt" < started_before
$$;

REVOKE ALL ON FUNCTION "platform"."worker_can_access_research_recovery"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "platform"."worker_can_access_research_recovery"() TO ams_worker;

DO $verify$
DECLARE
  direct_result BOOLEAN;
  wrapped_result BOOLEAN;
BEGIN
  CREATE FUNCTION pg_temp.verify_restricted_runtime_wrapper()
  RETURNS BOOLEAN
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = platform, pg_catalog, pg_temp
  AS 'SELECT platform.is_restricted_runtime()';

  SELECT "platform"."is_restricted_runtime"() INTO direct_result;
  SELECT pg_temp.verify_restricted_runtime_wrapper() INTO wrapped_result;

  IF direct_result IS DISTINCT FROM wrapped_result THEN
    RAISE EXCEPTION 'restricted runtime detection must not change across SECURITY DEFINER boundaries';
  END IF;

  DROP FUNCTION pg_temp.verify_restricted_runtime_wrapper();
END
$verify$;

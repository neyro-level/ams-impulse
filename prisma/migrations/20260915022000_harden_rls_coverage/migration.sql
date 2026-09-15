CREATE OR REPLACE FUNCTION "platform"."worker_can_access_seo_project"(
  target_organization_id TEXT,
  target_project_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT session_user = 'ams_worker'
    AND NULLIF(current_setting('ams.job_organization_id', true), '') = target_organization_id
    AND NULLIF(current_setting('ams.job_project_id', true), '') = target_project_id
$$;

CREATE OR REPLACE FUNCTION "platform"."worker_can_access_tools_project"(
  target_organization_id TEXT,
  target_project_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT session_user = 'ams_worker'
    AND NULLIF(current_setting('ams.job_organization_id', true), '') = target_organization_id
    AND NULLIF(current_setting('ams.job_project_id', true), '') = target_project_id
$$;

ALTER TABLE "public"."Member" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Member" NO FORCE ROW LEVEL SECURITY;

CREATE POLICY "member_select" ON "public"."Member"
  FOR SELECT USING (
    NOT "platform"."is_restricted_runtime"()
    OR "userId" = "platform"."current_user_id"()
    OR "platform"."is_platform_admin"()
  );
CREATE POLICY "member_insert" ON "public"."Member"
  FOR INSERT WITH CHECK (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."is_platform_admin"()
  );
CREATE POLICY "member_update" ON "public"."Member"
  FOR UPDATE
  USING (NOT "platform"."is_restricted_runtime"() OR "platform"."is_platform_admin"())
  WITH CHECK (NOT "platform"."is_restricted_runtime"() OR "platform"."is_platform_admin"());
CREATE POLICY "member_delete" ON "public"."Member"
  FOR DELETE USING (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."is_platform_admin"()
  );

DROP POLICY "tracked_query_scope" ON "public"."TrackedQuery";
CREATE POLICY "tracked_query_scope" ON "public"."TrackedQuery"
  USING (
    NOT "platform"."is_restricted_runtime"()
    OR EXISTS (
      SELECT 1
      FROM "public"."TrackedQuerySet" AS query_set
      WHERE query_set.id = "TrackedQuery"."trackedQuerySetId"
        AND query_set."organizationId" = "TrackedQuery"."organizationId"
        AND "platform"."can_access_seo_site"(query_set."organizationId", query_set."siteId")
    )
  )
  WITH CHECK (
    NOT "platform"."is_restricted_runtime"()
    OR EXISTS (
      SELECT 1
      FROM "public"."TrackedQuerySet" AS query_set
      WHERE query_set.id = "TrackedQuery"."trackedQuerySetId"
        AND query_set."organizationId" = "TrackedQuery"."organizationId"
        AND "platform"."can_access_seo_site"(query_set."organizationId", query_set."siteId")
    )
  );

DROP POLICY "ranking_scope" ON "public"."RankingCapture";
CREATE POLICY "ranking_scope" ON "public"."RankingCapture"
  USING (
    NOT "platform"."is_restricted_runtime"()
    OR EXISTS (
      SELECT 1
      FROM "public"."TrackedQuery" AS query
      JOIN "public"."TrackedQuerySet" AS query_set
        ON query_set.id = query."trackedQuerySetId"
      WHERE query.id = "RankingCapture"."trackedQueryId"
        AND query."organizationId" = "RankingCapture"."organizationId"
        AND "platform"."can_access_seo_site"(query_set."organizationId", query_set."siteId")
    )
  )
  WITH CHECK (
    NOT "platform"."is_restricted_runtime"()
    OR EXISTS (
      SELECT 1
      FROM "public"."TrackedQuery" AS query
      JOIN "public"."TrackedQuerySet" AS query_set
        ON query_set.id = query."trackedQuerySetId"
      WHERE query.id = "RankingCapture"."trackedQueryId"
        AND query."organizationId" = "RankingCapture"."organizationId"
        AND "platform"."can_access_seo_site"(query_set."organizationId", query_set."siteId")
    )
  );

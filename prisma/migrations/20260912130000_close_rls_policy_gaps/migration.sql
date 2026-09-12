CREATE OR REPLACE FUNCTION "platform"."is_platform_admin"()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "public"."User" AS app_user
    WHERE app_user.id = "platform"."current_user_id"()
      AND app_user."disabledAt" IS NULL
      AND app_user."systemRole" = 'PLATFORM_ADMIN'::"public"."SystemRole"
  )
$$;

CREATE OR REPLACE FUNCTION "platform"."worker_can_access_seo_project"(
  target_organization_id TEXT,
  target_project_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT current_user = 'ams_worker'
    AND NULLIF(current_setting('ams.job_organization_id', true), '') = target_organization_id
    AND NULLIF(current_setting('ams.job_project_id', true), '') = target_project_id
$$;

CREATE OR REPLACE FUNCTION "platform"."can_access_tools_project"(
  target_organization_id TEXT,
  target_project_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, tools, pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "public"."User" AS app_user
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
      AND "platform"."can_access_seo_project"(site."organizationId", site."projectId")
  )
$$;

REVOKE ALL ON FUNCTION "platform"."is_platform_admin"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "platform"."worker_can_access_seo_project"(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "platform"."is_platform_admin"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION "platform"."worker_can_access_seo_project"(TEXT, TEXT) TO PUBLIC;

-- These relations are lookup inputs of SECURITY DEFINER authorization helpers.
-- Their owner must bypass their policies to avoid recursive RLS evaluation.
-- Runtime roles remain non-owners with NOBYPASSRLS and are still policy-bound.
ALTER TABLE "public"."Site" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "public"."SeoProjectAccess" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "tools"."ToolsMembership" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "tools"."ToolsProjectAccess" NO FORCE ROW LEVEL SECURITY;

DO $owner_check$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('public."Site"'::regclass, 'platform.can_access_seo_site(text,text)'::regprocedure),
      ('public."SeoProjectAccess"'::regclass, 'platform.can_access_seo_project(text,text)'::regprocedure),
      ('tools."ToolsMembership"'::regclass, 'platform.can_access_tools_project(text,text)'::regprocedure),
      ('tools."ToolsProjectAccess"'::regclass, 'platform.can_access_tools_project(text,text)'::regprocedure)
    ) AS protected_lookup(relation_oid, function_oid)
    JOIN pg_class AS relation ON relation.oid = protected_lookup.relation_oid
    JOIN pg_proc AS routine ON routine.oid = protected_lookup.function_oid
    WHERE relation.relowner <> routine.proowner
  ) THEN
    RAISE EXCEPTION 'RLS lookup relation and SECURITY DEFINER function owners must match';
  END IF;
END
$owner_check$;

ALTER TABLE "public"."SyncRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SyncRun" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sync_run_scope" ON "public"."SyncRun"
  USING (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."can_access_seo_project"("organizationId", "projectId")
  )
  WITH CHECK (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."can_access_seo_project"("organizationId", "projectId")
  );

DROP POLICY "project_access_scope" ON "public"."SeoProjectAccess";
CREATE POLICY "seo_project_access_select" ON "public"."SeoProjectAccess"
  FOR SELECT USING (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."can_access_seo_project"("organizationId", "projectId")
  );
CREATE POLICY "seo_project_access_insert" ON "public"."SeoProjectAccess"
  FOR INSERT WITH CHECK (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."is_platform_admin"()
  );
CREATE POLICY "seo_project_access_update" ON "public"."SeoProjectAccess"
  FOR UPDATE
  USING (NOT "platform"."is_restricted_runtime"() OR "platform"."is_platform_admin"())
  WITH CHECK (NOT "platform"."is_restricted_runtime"() OR "platform"."is_platform_admin"());
CREATE POLICY "seo_project_access_delete" ON "public"."SeoProjectAccess"
  FOR DELETE USING (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."is_platform_admin"()
  );

DROP POLICY "project_scope" ON "tools"."ToolsProjectAccess";
CREATE POLICY "tools_project_access_select" ON "tools"."ToolsProjectAccess"
  FOR SELECT USING (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."can_access_tools_project"("organizationId", "projectId")
  );
CREATE POLICY "tools_project_access_insert" ON "tools"."ToolsProjectAccess"
  FOR INSERT WITH CHECK (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."is_platform_admin"()
  );
CREATE POLICY "tools_project_access_update" ON "tools"."ToolsProjectAccess"
  FOR UPDATE
  USING (NOT "platform"."is_restricted_runtime"() OR "platform"."is_platform_admin"())
  WITH CHECK (NOT "platform"."is_restricted_runtime"() OR "platform"."is_platform_admin"());
CREATE POLICY "tools_project_access_delete" ON "tools"."ToolsProjectAccess"
  FOR DELETE USING (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."is_platform_admin"()
  );

DROP POLICY "membership_scope" ON "tools"."ToolsMembership";
CREATE POLICY "tools_membership_select" ON "tools"."ToolsMembership"
  FOR SELECT USING (
    NOT "platform"."is_restricted_runtime"()
    OR "userId" = "platform"."current_user_id"()
    OR "platform"."is_platform_admin"()
  );
CREATE POLICY "tools_membership_insert" ON "tools"."ToolsMembership"
  FOR INSERT WITH CHECK (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."is_platform_admin"()
  );
CREATE POLICY "tools_membership_update" ON "tools"."ToolsMembership"
  FOR UPDATE
  USING (NOT "platform"."is_restricted_runtime"() OR "platform"."is_platform_admin"())
  WITH CHECK (NOT "platform"."is_restricted_runtime"() OR "platform"."is_platform_admin"());
CREATE POLICY "tools_membership_delete" ON "tools"."ToolsMembership"
  FOR DELETE USING (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."is_platform_admin"()
  );

DROP POLICY "organization_scope" ON "tools"."ToolsOrganization";
CREATE POLICY "tools_organization_select" ON "tools"."ToolsOrganization"
  FOR SELECT USING (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."is_platform_admin"()
    OR EXISTS (
      SELECT 1
      FROM "tools"."ToolsMembership" AS membership
      WHERE membership."organizationId" = "ToolsOrganization".id
        AND membership."userId" = "platform"."current_user_id"()
    )
  );
CREATE POLICY "tools_organization_insert" ON "tools"."ToolsOrganization"
  FOR INSERT WITH CHECK (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."is_platform_admin"()
  );
CREATE POLICY "tools_organization_update" ON "tools"."ToolsOrganization"
  FOR UPDATE
  USING (NOT "platform"."is_restricted_runtime"() OR "platform"."is_platform_admin"())
  WITH CHECK (NOT "platform"."is_restricted_runtime"() OR "platform"."is_platform_admin"());
CREATE POLICY "tools_organization_delete" ON "tools"."ToolsOrganization"
  FOR DELETE USING (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."is_platform_admin"()
  );

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

CREATE OR REPLACE FUNCTION "platform"."worker_can_access_seo_organization"(
  target_organization_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT session_user = 'ams_worker'
    AND NULLIF(current_setting('ams.job_organization_id', true), '') = target_organization_id
$$;

CREATE OR REPLACE FUNCTION "platform"."can_access_seo_organization"(
  target_organization_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, platform, pg_catalog, pg_temp
AS $$
  SELECT "platform"."worker_can_access_seo_organization"(target_organization_id)
    OR EXISTS (
      SELECT 1
      FROM "public"."User" AS app_user
      WHERE app_user.id = "platform"."current_user_id"()
        AND app_user."disabledAt" IS NULL
        AND (
          app_user."systemRole" = 'PLATFORM_ADMIN'::"public"."SystemRole"
          OR EXISTS (
            SELECT 1
            FROM "public"."Member" AS membership
            WHERE membership."userId" = app_user.id
              AND membership."organizationId" = target_organization_id
          )
        )
    )
$$;

REVOKE ALL ON FUNCTION "platform"."worker_can_access_seo_organization"(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION "platform"."can_access_seo_organization"(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "platform"."worker_can_access_seo_organization"(TEXT) TO ams_web, ams_worker;
GRANT EXECUTE ON FUNCTION "platform"."can_access_seo_organization"(TEXT) TO ams_web, ams_worker;

DROP POLICY "notification_scope" ON "public"."Notification";

CREATE POLICY "notification_select" ON "public"."Notification"
  FOR SELECT USING (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."is_platform_admin"()
    OR (
      "visibility" = 'PLATFORM_TEAM'::"public"."NotificationVisibility"
      AND "organizationId" IS NOT NULL
      AND (
        ("projectId" IS NOT NULL AND "platform"."can_access_seo_project"("organizationId", "projectId"))
        OR ("projectId" IS NULL AND "platform"."can_access_seo_organization"("organizationId"))
      )
    )
  );

CREATE POLICY "notification_insert" ON "public"."Notification"
  FOR INSERT WITH CHECK (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."is_platform_admin"()
    OR (
      "organizationId" IS NOT NULL
      AND (
        ("projectId" IS NOT NULL AND "platform"."worker_can_access_seo_project"("organizationId", "projectId"))
        OR ("projectId" IS NULL AND "platform"."worker_can_access_seo_organization"("organizationId"))
        OR (
          "visibility" = 'PLATFORM_TEAM'::"public"."NotificationVisibility"
          AND (
            ("projectId" IS NOT NULL AND "platform"."can_access_seo_project"("organizationId", "projectId"))
            OR ("projectId" IS NULL AND "platform"."can_access_seo_organization"("organizationId"))
          )
        )
      )
    )
  );

CREATE POLICY "notification_update" ON "public"."Notification"
  FOR UPDATE
  USING (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."is_platform_admin"()
    OR (
      "organizationId" IS NOT NULL
      AND (
        ("projectId" IS NOT NULL AND "platform"."worker_can_access_seo_project"("organizationId", "projectId"))
        OR ("projectId" IS NULL AND "platform"."worker_can_access_seo_organization"("organizationId"))
        OR (
          "visibility" = 'PLATFORM_TEAM'::"public"."NotificationVisibility"
          AND (
            ("projectId" IS NOT NULL AND "platform"."can_access_seo_project"("organizationId", "projectId"))
            OR ("projectId" IS NULL AND "platform"."can_access_seo_organization"("organizationId"))
          )
        )
      )
    )
  )
  WITH CHECK (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."is_platform_admin"()
    OR (
      "organizationId" IS NOT NULL
      AND (
        ("projectId" IS NOT NULL AND "platform"."worker_can_access_seo_project"("organizationId", "projectId"))
        OR ("projectId" IS NULL AND "platform"."worker_can_access_seo_organization"("organizationId"))
        OR (
          "visibility" = 'PLATFORM_TEAM'::"public"."NotificationVisibility"
          AND (
            ("projectId" IS NOT NULL AND "platform"."can_access_seo_project"("organizationId", "projectId"))
            OR ("projectId" IS NULL AND "platform"."can_access_seo_organization"("organizationId"))
          )
        )
      )
    )
  );

CREATE POLICY "notification_delete" ON "public"."Notification"
  FOR DELETE USING (
    NOT "platform"."is_restricted_runtime"()
    OR "platform"."is_platform_admin"()
    OR (
      "organizationId" IS NOT NULL
      AND (
        ("projectId" IS NOT NULL AND "platform"."worker_can_access_seo_project"("organizationId", "projectId"))
        OR ("projectId" IS NULL AND "platform"."worker_can_access_seo_organization"("organizationId"))
        OR (
          "visibility" = 'PLATFORM_TEAM'::"public"."NotificationVisibility"
          AND (
            ("projectId" IS NOT NULL AND "platform"."can_access_seo_project"("organizationId", "projectId"))
            OR ("projectId" IS NULL AND "platform"."can_access_seo_organization"("organizationId"))
          )
        )
      )
    )
  );

ALTER TABLE "public"."NotificationRead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."NotificationRead" FORCE ROW LEVEL SECURITY;

CREATE POLICY "notification_read_owner" ON "public"."NotificationRead"
  USING (
    NOT "platform"."is_restricted_runtime"()
    OR (
      "userId" = "platform"."current_user_id"()
      AND EXISTS (
        SELECT 1
        FROM "public"."Notification" AS notification
        WHERE notification.id = "NotificationRead"."notificationId"
      )
    )
  )
  WITH CHECK (
    NOT "platform"."is_restricted_runtime"()
    OR (
      "userId" = "platform"."current_user_id"()
      AND EXISTS (
        SELECT 1
        FROM "public"."Notification" AS notification
        WHERE notification.id = "NotificationRead"."notificationId"
      )
    )
  );

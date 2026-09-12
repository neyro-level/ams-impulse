ALTER TABLE "public"."AuditEvent"
  DROP CONSTRAINT "AuditEvent_organizationId_fkey";

ALTER TABLE "public"."AuditEvent"
  ADD COLUMN "productCode" TEXT,
  ADD COLUMN "projectId" TEXT;

UPDATE "public"."AuditEvent"
SET
  "productCode" = 'tools',
  "organizationId" = "afterMarker" ->> 'toolsOrganizationId',
  "projectId" = "afterMarker" ->> 'toolsProjectId'
WHERE "source" = 'research';

DO $scope_check$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "public"."AuditEvent"
    WHERE "source" = 'research'
      AND (
        "productCode" IS DISTINCT FROM 'tools'
        OR "organizationId" IS NULL
        OR "projectId" IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'Existing Research AuditEvent rows do not contain a complete Tools scope';
  END IF;
END
$scope_check$;

ALTER TABLE "public"."AuditEvent"
  ADD CONSTRAINT "AuditEvent_research_scope_check"
  CHECK (
    "source" <> 'research'
    OR (
      "productCode" = 'tools'
      AND "organizationId" IS NOT NULL
      AND "projectId" IS NOT NULL
    )
  );

CREATE INDEX "AuditEvent_productCode_organizationId_projectId_createdAt_idx"
  ON "public"."AuditEvent"("productCode", "organizationId", "projectId", "createdAt");

COMMENT ON COLUMN "public"."AuditEvent"."organizationId" IS
  'Product-local organization identifier; interpret together with productCode.';

COMMENT ON COLUMN "public"."AuditEvent"."projectId" IS
  'Optional product-local project identifier; required for Research audit events.';

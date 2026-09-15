DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "research"."Run"
    WHERE "status" IN ('AWAITING_CONFIRMATION', 'QUEUED', 'RUNNING')
    GROUP BY "organizationId", "requestKey"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'active Research requestKey values must be unique per organization';
  END IF;
END
$verify$;

CREATE UNIQUE INDEX "Run_organizationId_requestKey_active_key"
  ON "research"."Run"("organizationId", "requestKey")
  WHERE "status" IN ('AWAITING_CONFIRMATION', 'QUEUED', 'RUNNING');

ALTER TABLE "research"."Run" ADD COLUMN "requestKey" TEXT;

UPDATE "research"."Run"
SET "requestKey" = "idempotencyKey"
WHERE "requestKey" IS NULL;

CREATE FUNCTION "research"."fill_run_request_key"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."requestKey" IS NULL THEN
    NEW."requestKey" := NEW."idempotencyKey";
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION "research"."fill_run_request_key"()
  FROM PUBLIC, ams_web, ams_worker, ams_backup;

CREATE TRIGGER "Run_fill_request_key"
BEFORE INSERT ON "research"."Run"
FOR EACH ROW EXECUTE FUNCTION "research"."fill_run_request_key"();

ALTER TABLE "research"."Run" ALTER COLUMN "requestKey" SET NOT NULL;

CREATE INDEX "Run_organizationId_requestKey_createdAt_idx"
  ON "research"."Run"("organizationId", "requestKey", "createdAt" DESC);

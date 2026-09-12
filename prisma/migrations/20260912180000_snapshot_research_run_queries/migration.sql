ALTER TABLE "research"."QueryRun"
  ADD COLUMN "queryText" TEXT,
  ADD COLUMN "queryPosition" INTEGER;

UPDATE "research"."QueryRun" AS query_run
SET "queryText" = query."text", "queryPosition" = query."position"
FROM "research"."Query" AS query
WHERE query.id = query_run."queryId"
  AND query."organizationId" = query_run."organizationId"
  AND query."projectId" = query_run."projectId";

INSERT INTO "research"."QueryRun"
  ("id", "organizationId", "projectId", "researchId", "runId", "queryId", "queryText", "queryPosition", "status", "attemptCount")
SELECT gen_random_uuid()::text, query."organizationId", query."projectId", run."researchId", run.id, query.id, query."text", query."position", 'PENDING', 0
FROM "research"."Run" AS run
JOIN "research"."Query" AS query
  ON query."researchId" = run."researchId"
 AND query."organizationId" = run."organizationId"
 AND query."projectId" = run."projectId"
WHERE NOT EXISTS (SELECT 1 FROM "research"."QueryRun" AS existing WHERE existing."runId" = run.id);

ALTER TABLE "research"."QueryRun"
  ALTER COLUMN "queryText" SET NOT NULL,
  ALTER COLUMN "queryPosition" SET NOT NULL,
  ALTER COLUMN "queryId" DROP NOT NULL,
  ADD CONSTRAINT "QueryRun_queryPosition_check" CHECK ("queryPosition" >= 0);

ALTER TABLE "research"."QueryRun"
  DROP CONSTRAINT IF EXISTS "QueryRun_organizationId_projectId_queryId_fkey",
  ADD CONSTRAINT "QueryRun_organizationId_projectId_queryId_fkey"
    FOREIGN KEY ("organizationId", "projectId", "queryId")
    REFERENCES "research"."Query"("organizationId", "projectId", "id")
    ON DELETE SET NULL ("queryId") ON UPDATE CASCADE;

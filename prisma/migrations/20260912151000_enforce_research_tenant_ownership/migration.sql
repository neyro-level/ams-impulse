-- Carry the full tenant + research scope through execution and export relations.
-- This prevents valid IDs from the same Tools project but a different Research
-- aggregate from being linked together.
ALTER TABLE "research"."QueryRun" ADD COLUMN "researchId" TEXT;

UPDATE "research"."QueryRun" AS query_run
SET "researchId" = query."researchId"
FROM "research"."Query" AS query
WHERE query.id = query_run."queryId"
  AND query."organizationId" = query_run."organizationId"
  AND query."projectId" = query_run."projectId";

ALTER TABLE "research"."QueryRun" ALTER COLUMN "researchId" SET NOT NULL;

ALTER TABLE "research"."Query"
  ADD CONSTRAINT "Query_tenant_research_id_key"
  UNIQUE ("organizationId", "projectId", "researchId", "id");

ALTER TABLE "research"."Run"
  ADD CONSTRAINT "Run_tenant_research_id_key"
  UNIQUE ("organizationId", "projectId", "researchId", "id");

ALTER TABLE "research"."QueryRun"
  DROP CONSTRAINT "QueryRun_organizationId_projectId_runId_fkey",
  DROP CONSTRAINT "QueryRun_organizationId_projectId_queryId_fkey",
  ADD CONSTRAINT "QueryRun_tenant_research_run_fkey"
    FOREIGN KEY ("organizationId", "projectId", "researchId", "runId")
    REFERENCES "research"."Run"("organizationId", "projectId", "researchId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "QueryRun_tenant_research_query_fkey"
    FOREIGN KEY ("organizationId", "projectId", "researchId", "queryId")
    REFERENCES "research"."Query"("organizationId", "projectId", "researchId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "research"."Export"
  DROP CONSTRAINT "Export_organizationId_projectId_runId_fkey",
  ADD CONSTRAINT "Export_tenant_research_run_fkey"
    FOREIGN KEY ("organizationId", "projectId", "researchId", "runId")
    REFERENCES "research"."Run"("organizationId", "projectId", "researchId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

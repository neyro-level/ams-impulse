import { Prisma, type PrismaClient } from "../../../generated/prisma/client.ts";
import { getPrismaClient } from "../../../platform/database/prisma/client.ts";
import { newId } from "../../../platform/identifiers/new-id.ts";
import { setDatabaseJobContext, type DatabaseJobContext } from "../../../platform/database/authorization-context.ts";
import type { DatabaseTransaction } from "../../../platform/database/transaction.ts";
import type { ClaimedResearchRun, ResearchExecutionRepository, ResearchRunClaim } from "../application/ports/research-execution-repository.ts";
import type { SearchEvidence, WordstatEvidence } from "../application/ports/research-provider.ts";
import { ResearchStateError } from "../domain/research.ts";

export const RESEARCH_EVIDENCE_BATCH_SIZE = 250;

interface EvidenceInsertRow {
  id: string;
  sourceType: string;
  sourceUrl: string | null;
  title: string;
  snippet: string | null;
  payload: string;
}

function batches<T>(rows: T[], size = RESEARCH_EVIDENCE_BATCH_SIZE): T[][] {
  const output: T[][] = [];
  for (let offset = 0; offset < rows.length; offset += size) output.push(rows.slice(offset, offset + size));
  return output;
}

export class PrismaResearchExecutionRepository implements ResearchExecutionRepository {
  constructor(private readonly jobContext: DatabaseJobContext, private readonly injectedPrisma?: PrismaClient) {}
  private get prisma() { return this.injectedPrisma ?? getPrismaClient(); }
  private withContext<T>(operation: (transaction: DatabaseTransaction) => Promise<T>) {
    return this.prisma.$transaction(async (transaction) => {
      await setDatabaseJobContext(transaction, this.jobContext);
      return operation(transaction);
    });
  }

  async failStaleRuns(startedBefore: Date) {
    return this.withContext(async (transaction) => {
      const stale = await transaction.$queryRaw<Array<{ id: string; researchId: string }>>(Prisma.sql`
        SELECT "id", "researchId" FROM "research"."Run"
        WHERE "status"='RUNNING' AND "startedAt" < ${startedBefore}
          AND "organizationId"=${this.jobContext.organizationId} AND "projectId"=${this.jobContext.projectId}
        FOR UPDATE SKIP LOCKED
      `);
      for (const run of stale) {
        await transaction.$executeRaw(Prisma.sql`UPDATE "research"."QueryRun" SET "status"='FAILED', "safeErrorCode"=CASE WHEN "status"='PENDING' THEN 'RESEARCH_RUN_ABORTED' ELSE 'WORKER_INTERRUPTED_AMBIGUOUS' END, "finishedAt"=CURRENT_TIMESTAMP WHERE "runId"=${run.id} AND "status" IN ('PENDING','RUNNING')`);
        await transaction.$executeRaw(Prisma.sql`UPDATE "research"."Run" SET "status"='FAILED', "allocatedCostKopecks"=(SELECT COALESCE(SUM("allocatedCostKopecks"),0) FROM "research"."QueryRun" WHERE "runId"=${run.id}), "safeErrorCode"='WORKER_INTERRUPTED_AMBIGUOUS', "finishedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${run.id}`);
        await transaction.$executeRaw(Prisma.sql`UPDATE "research"."Research" SET "status"='FAILED', "version"="version"+1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${run.researchId} AND "status"='RUNNING'`);
      }
      return stale.length;
    });
  }

  async claimRun(runId: string): Promise<ResearchRunClaim> {
    return this.withContext(async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${`research.run.v1:${runId}`}, 0)) AS "locked"`);
      if (!locked[0]?.locked) return { status: "lock-busy" as const };
      const runs = await transaction.$queryRaw<Array<Omit<ClaimedResearchRun, "queries"> & { status: string }>>(Prisma.sql`
        SELECT "id" AS "runId", "organizationId", "projectId", "researchId", "approvedCostKopecks", "status"::text AS "status"
        FROM "research"."Run" WHERE "id"=${runId}
          AND "organizationId"=${this.jobContext.organizationId} AND "projectId"=${this.jobContext.projectId}
        FOR UPDATE
      `);
      const run = runs[0]; if (!run || run.status !== "QUEUED" || run.approvedCostKopecks === null) return { status: "not-claimable" as const };
      await transaction.$executeRaw(Prisma.sql`UPDATE "research"."Run" SET "status"='RUNNING', "startedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${runId}`);
      await transaction.$executeRaw(Prisma.sql`UPDATE "research"."Research" SET "status"='RUNNING', "version"="version"+1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${run.researchId} AND "organizationId"=${run.organizationId} AND "projectId"=${run.projectId}`);
      const queries = await transaction.$queryRaw<Array<{ queryRunId: string; queryId: string | null; text: string }>>(Prisma.sql`
        SELECT "id" AS "queryRunId", "queryId", "queryText" AS "text"
        FROM "research"."QueryRun"
        WHERE "runId"=${runId} AND "status"='PENDING' ORDER BY "queryPosition"
      `);
      return { status: "claimed" as const, run: { runId: run.runId, organizationId: run.organizationId, projectId: run.projectId, researchId: run.researchId, approvedCostKopecks: run.approvedCostKopecks, queries } };
    });
  }

  async markQueryStarted(queryRunId: string) {
    return this.withContext(async (transaction) => (
      await transaction.$executeRaw(Prisma.sql`UPDATE "research"."QueryRun" SET "status"='RUNNING', "attemptCount"="attemptCount"+1, "startedAt"=CURRENT_TIMESTAMP WHERE "id"=${queryRunId} AND "status"='PENDING'`)
    ) === 1);
  }

  async completeQuery(input: { queryRunId: string; search: SearchEvidence[]; wordstat: WordstatEvidence[]; allocatedCostKopecks: number }) {
    await this.withContext(async (transaction) => {
      const scopes = await transaction.$queryRaw<Array<{ organizationId: string; projectId: string }>>(Prisma.sql`SELECT "organizationId", "projectId" FROM "research"."QueryRun" WHERE "id"=${input.queryRunId} AND "status"='RUNNING' FOR UPDATE`);
      const scope = scopes[0]; if (!scope) throw new ResearchStateError("QUERY_RUN_NOT_RUNNING");
      const evidenceRows: EvidenceInsertRow[] = [
        ...input.search.map((evidence) => ({ id: newId(), sourceType: evidence.type, sourceUrl: evidence.url, title: evidence.title, snippet: evidence.snippet, payload: JSON.stringify(evidence) })),
        ...input.wordstat.map((evidence) => ({ id: newId(), sourceType: "wordstat", sourceUrl: null, title: evidence.phrase, snippet: null, payload: JSON.stringify(evidence) })),
      ];
      for (const batch of batches(evidenceRows)) {
        const values = Prisma.join(batch.map((row) => Prisma.sql`
          (${row.id}, ${scope.organizationId}, ${scope.projectId}, ${input.queryRunId}, ${row.sourceType}, ${row.sourceUrl}, ${row.title}, ${row.snippet}, ${row.payload}::jsonb)
        `));
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "research"."Evidence"
            ("id", "organizationId", "projectId", "queryRunId", "sourceType", "sourceUrl", "title", "snippet", "payload")
          VALUES ${values}
        `);
      }
      await transaction.$executeRaw(Prisma.sql`UPDATE "research"."QueryRun" SET "status"='SUCCEEDED', "allocatedCostKopecks"=${input.allocatedCostKopecks}, "finishedAt"=CURRENT_TIMESTAMP WHERE "id"=${input.queryRunId}`);
    });
  }

  async failQuery(queryRunId: string, safeErrorCode: string, allocatedCostKopecks: number) {
    await this.withContext(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`UPDATE "research"."QueryRun" SET "status"='FAILED', "allocatedCostKopecks"=${allocatedCostKopecks}, "safeErrorCode"=${safeErrorCode}, "finishedAt"=CURRENT_TIMESTAMP WHERE "id"=${queryRunId} AND "status"='RUNNING'`);
    });
  }
  async failRun(runId: string, safeErrorCode: string) {
    await this.withContext(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`UPDATE "research"."QueryRun" SET "status"='FAILED', "safeErrorCode"=CASE WHEN "status"='PENDING' THEN 'RESEARCH_RUN_ABORTED' ELSE ${safeErrorCode} END, "finishedAt"=CURRENT_TIMESTAMP WHERE "runId"=${runId} AND "status" IN ('PENDING','RUNNING')`);
      const runs = await transaction.$queryRaw<Array<{ researchId: string }>>(Prisma.sql`UPDATE "research"."Run" SET "status"='FAILED', "allocatedCostKopecks"=(SELECT COALESCE(SUM("allocatedCostKopecks"),0) FROM "research"."QueryRun" WHERE "runId"=${runId}), "safeErrorCode"=${safeErrorCode}, "finishedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${runId} AND "status" IN ('RUNNING','QUEUED') RETURNING "researchId"`);
      if (runs[0]) await transaction.$executeRaw(Prisma.sql`UPDATE "research"."Research" SET "status"='FAILED', "version"="version"+1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${runs[0].researchId} AND "status"='RUNNING'`);
    });
  }

  async completeRun(run: ClaimedResearchRun) {
    return this.withContext(async (transaction) => {
      const domains = await transaction.$queryRaw<Array<{ domain: string; matchedQueryCount: bigint; visibilityScore: number }>>(Prisma.sql`
        SELECT evidence."payload"->>'domain' AS "domain", COUNT(DISTINCT query_run."id")::bigint AS "matchedQueryCount", COUNT(*)::float8 AS "visibilityScore"
        FROM "research"."Evidence" AS evidence JOIN "research"."QueryRun" AS query_run ON query_run.id=evidence."queryRunId"
        WHERE query_run."runId"=${run.runId} AND evidence."sourceType"='organic' AND evidence."payload"->>'domain' IS NOT NULL
        GROUP BY evidence."payload"->>'domain' ORDER BY "visibilityScore" DESC, "domain"
      `);
      for (const domain of domains) {
        await transaction.$executeRaw(Prisma.sql`INSERT INTO "research"."CompetitorProjection" ("id", "organizationId", "projectId", "runId", "domain", "visibilityScore", "matchedQueryCount", "payload") VALUES (${newId()}, ${run.organizationId}, ${run.projectId}, ${run.runId}, ${domain.domain}, ${domain.visibilityScore}, ${Number(domain.matchedQueryCount)}, ${JSON.stringify({ domain: domain.domain, matchedQueryCount: Number(domain.matchedQueryCount), visibilityScore: domain.visibilityScore })}::jsonb) ON CONFLICT ("runId", "domain") DO UPDATE SET "visibilityScore"=EXCLUDED."visibilityScore", "matchedQueryCount"=EXCLUDED."matchedQueryCount", "payload"=EXCLUDED."payload"`);
      }
      const counts = await transaction.$queryRaw<Array<{ failedCount: number; nonterminalCount: number }>>(Prisma.sql`SELECT COUNT(*) FILTER (WHERE "status"='FAILED')::int AS "failedCount", COUNT(*) FILTER (WHERE "status" IN ('PENDING','RUNNING'))::int AS "nonterminalCount" FROM "research"."QueryRun" WHERE "runId"=${run.runId}`);
      if ((counts[0]?.nonterminalCount ?? 0) > 0) throw new Error("RESEARCH_NONTERMINAL_QUERY_RUNS");
      const finalStatus = (counts[0]?.failedCount ?? 0) > 0 ? "PARTIAL" : "SUCCEEDED";
      await transaction.$executeRaw(Prisma.sql`UPDATE "research"."Run" SET "status"=${finalStatus}::"research"."RunStatus", "allocatedCostKopecks"=(SELECT COALESCE(SUM("allocatedCostKopecks"),0) FROM "research"."QueryRun" WHERE "runId"=${run.runId}), "finishedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${run.runId} AND "status"='RUNNING'`);
      await transaction.$executeRaw(Prisma.sql`UPDATE "research"."Research" SET "status"=${finalStatus}::"research"."ResearchStatus", "version"="version"+1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${run.researchId} AND "organizationId"=${run.organizationId} AND "projectId"=${run.projectId}`);
      return finalStatus === "PARTIAL" ? "partial" as const : "succeeded" as const;
    });
  }
}

export async function listStaleResearchRunScopes(
  startedBefore: Date,
  prisma: PrismaClient = getPrismaClient(),
): Promise<DatabaseJobContext[]> {
  return prisma.$queryRaw<DatabaseJobContext[]>(Prisma.sql`
    SELECT "organizationId", "projectId"
    FROM "platform"."stale_research_run_scopes"(${startedBefore})
  `);
}

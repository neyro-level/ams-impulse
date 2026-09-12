import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "../../../generated/prisma/client.ts";
import { setDatabaseAuthorizationContext } from "../../../platform/database/authorization-context.ts";
import { getPrismaClient } from "../../../platform/database/prisma/client.ts";
import type { DatabaseTransaction } from "../../../platform/database/transaction.ts";
import type { ResearchExportRecord, ResearchReportRepository, ResearchRunReport } from "../application/ports/research-report-repository.ts";
import type { ResearchRef } from "../domain/research.ts";

export class PrismaResearchReportRepository implements ResearchReportRepository {
  constructor(private readonly databaseUserId: string, private readonly injectedPrisma?: PrismaClient) {}
  private get prisma() { return this.injectedPrisma ?? getPrismaClient(); }
  private withContext<T>(operation: (transaction: DatabaseTransaction) => Promise<T>) {
    return this.prisma.$transaction(async (transaction) => {
      await setDatabaseAuthorizationContext(transaction, { kind: "user", userId: this.databaseUserId });
      return operation(transaction);
    });
  }

  async getRunReport(ref: ResearchRef & { runId: string }): Promise<ResearchRunReport | null> {
    return this.withContext(async (transaction) => {
      const runs = await transaction.$queryRaw<Array<Omit<ResearchRunReport, "queries" | "competitors" | "createdAt" | "finishedAt"> & { createdAt: Date; finishedAt: Date | null }>>(Prisma.sql`
        SELECT "id" AS "runId", "status"::text, "estimatedCostKopecks", "approvedCostKopecks", "actualCostKopecks", "safeErrorCode", "createdAt", "finishedAt"
        FROM "research"."Run" WHERE "id"=${ref.runId} AND "researchId"=${ref.researchId}
          AND "organizationId"=${ref.organizationId} AND "projectId"=${ref.projectId} LIMIT 1
      `);
      const run = runs[0]; if (!run) return null;
      const queryRows = await transaction.$queryRaw<Array<{ queryRunId: string | null; query: string; status: string; costKopecks: number | null }>>(Prisma.sql`
        SELECT query_run."id" AS "queryRunId", query."text" AS "query", COALESCE(query_run."status"::text, 'PENDING') AS "status", query_run."costKopecks"
        FROM "research"."Query" AS query LEFT JOIN "research"."QueryRun" AS query_run
          ON query_run."queryId"=query.id AND query_run."runId"=${ref.runId}
        WHERE query."researchId"=${ref.researchId} AND query."organizationId"=${ref.organizationId} AND query."projectId"=${ref.projectId}
        ORDER BY query."position"
      `);
      const evidence = await transaction.$queryRaw<Array<{ queryRunId: string; type: string; url: string | null; title: string | null; snippet: string | null }>>(Prisma.sql`
        SELECT "queryRunId", "sourceType" AS "type", "sourceUrl" AS "url", "title", "snippet"
        FROM "research"."Evidence" WHERE "organizationId"=${ref.organizationId} AND "projectId"=${ref.projectId}
          AND "queryRunId" IN (SELECT "id" FROM "research"."QueryRun" WHERE "runId"=${ref.runId})
        ORDER BY "collectedAt", "id"
      `);
      const competitors = await transaction.$queryRaw<ResearchRunReport["competitors"]>(Prisma.sql`
        SELECT "domain", "visibilityScore", "matchedQueryCount" FROM "research"."CompetitorProjection"
        WHERE "runId"=${ref.runId} AND "organizationId"=${ref.organizationId} AND "projectId"=${ref.projectId}
        ORDER BY "visibilityScore" DESC, "domain"
      `);
      return {
        ...run,
        createdAt: run.createdAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
        queries: queryRows.map((query) => ({
          ...query,
          evidence: query.queryRunId
            ? evidence
                .filter((item) => item.queryRunId === query.queryRunId)
                .map((item) => ({ type: item.type, url: item.url, title: item.title, snippet: item.snippet }))
            : [],
        })),
        competitors,
      };
    });
  }

  async reserveExport(input: ResearchRef & { runId: string; idempotencyKey: string; actorId: string }): Promise<ResearchExportRecord> {
    return this.withContext(async (transaction) => {
      const id = randomUUID();
      const rows = await transaction.$queryRaw<ResearchExportRecord[]>(Prisma.sql`
        INSERT INTO "research"."Export" ("id", "organizationId", "projectId", "researchId", "runId", "format", "status", "createdByUserId", "idempotencyKey", "createdAt")
        VALUES (${id}, ${input.organizationId}, ${input.projectId}, ${input.researchId}, ${input.runId}, 'csv', 'PENDING', ${input.actorId}, ${input.idempotencyKey}, CURRENT_TIMESTAMP)
        ON CONFLICT ("organizationId", "idempotencyKey") DO UPDATE SET "idempotencyKey"=EXCLUDED."idempotencyKey"
        RETURNING "id" AS "exportId", "status"::text AS "status", "objectKey"
      `);
      return rows[0]!;
    });
  }

  async markExportReady(exportId: string, objectKey: string, expiresAt: Date) {
    await this.withContext(async (transaction) => { await transaction.$executeRaw(Prisma.sql`UPDATE "research"."Export" SET "status"='READY', "objectKey"=${objectKey}, "expiresAt"=${expiresAt} WHERE "id"=${exportId}`); });
  }
  async markExportFailed(exportId: string) {
    await this.withContext(async (transaction) => { await transaction.$executeRaw(Prisma.sql`UPDATE "research"."Export" SET "status"='FAILED' WHERE "id"=${exportId} AND "status"='PENDING'`); });
  }
  async getExport(ref: ResearchRef & { exportId: string }): Promise<ResearchExportRecord | null> {
    return this.withContext(async (transaction) => {
      const rows = await transaction.$queryRaw<ResearchExportRecord[]>(Prisma.sql`SELECT "id" AS "exportId", "status"::text AS "status", "objectKey" FROM "research"."Export" WHERE "id"=${ref.exportId} AND "researchId"=${ref.researchId} AND "organizationId"=${ref.organizationId} AND "projectId"=${ref.projectId} AND ("expiresAt" IS NULL OR "expiresAt">CURRENT_TIMESTAMP) LIMIT 1`);
      return rows[0] ?? null;
    });
  }
}

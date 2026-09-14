import { Prisma, type PrismaClient } from "../../../generated/prisma/client.ts";
import { getPrismaClient } from "../../../platform/database/prisma/client.ts";
import { setDatabaseAuthorizationContext } from "../../../platform/database/authorization-context.ts";
import type { DatabaseTransaction } from "../../../platform/database/transaction.ts";
import { newId } from "../../../platform/identifiers/new-id.ts";
import type {
  CreateResearchInput,
  ResearchListItem,
  ResearchListQuery,
  ResearchListResult,
  ResearchRecord,
  ResearchRef,
  ResearchRunStatus,
  ResearchRunSummary,
  UpdateResearchInput,
} from "../domain/research.ts";
import type { ResearchAuditJsonValue, ResearchRepository } from "../application/ports/research-repository.ts";
import { ResearchError } from "../domain/research.ts";
import { deriveResearchEstimateAttemptKey } from "../domain/research-idempotency.ts";

type Store = PrismaClient | DatabaseTransaction;
type ResearchRow = Omit<ResearchRecord, "queries" | "updatedAt"> & { updatedAt: Date };
type QueryRow = { id: string; researchId: string; text: string; position: number };
type ResearchListRow = Omit<ResearchListItem, "updatedAt" | "lastRun" | "queryCount"> & {
  queryCount: bigint;
  updatedAt: Date;
  lastRunId: string | null;
  lastRunStatus: ResearchRunStatus | null;
  lastRunQueryCount: number | null;
  lastRunEstimatedCostKopecks: number | null;
  lastRunAllocatedCostKopecks: number | null;
  lastRunSafeErrorCode: string | null;
  lastRunCreatedAt: Date | null;
};

function toRecord(row: ResearchRow, queries: QueryRow[]): ResearchRecord {
  return {
    ...row,
    updatedAt: row.updatedAt.toISOString(),
    queries: queries
      .filter((query) => query.researchId === row.id)
      .sort((left, right) => left.position - right.position)
      .map(({ id, text, position }) => ({ id, text, position })),
  };
}

async function appendAudit(
  store: Store,
  input: {
    organizationId: string;
    projectId: string;
    actorId: string;
    action: string;
    entityId: string;
    correlationId: string;
    marker: { [key: string]: ResearchAuditJsonValue };
  },
) {
  await store.$executeRaw(Prisma.sql`
    INSERT INTO "public"."AuditEvent"
      ("id", "productCode", "organizationId", "projectId", "actorType", "actorId", "action", "entityType", "entityId", "beforeMarker", "afterMarker", "source", "correlationId", "createdAt")
    VALUES
      (${newId()}, 'tools', ${input.organizationId}, ${input.projectId}, 'USER', ${input.actorId}, ${input.action}, 'Research', ${input.entityId}, NULL, ${JSON.stringify(input.marker)}::jsonb, 'research', ${input.correlationId}, CURRENT_TIMESTAMP)
  `);
}

export class PrismaResearchRepository implements ResearchRepository {
  constructor(private readonly databaseUserId: string, private readonly injectedPrisma?: PrismaClient) {}

  private get prisma(): PrismaClient {
    return this.injectedPrisma ?? getPrismaClient();
  }

  private withContext<T>(operation: (transaction: DatabaseTransaction) => Promise<T>) {
    return this.prisma.$transaction(async (transaction) => {
      await setDatabaseAuthorizationContext(transaction, { kind: "user", userId: this.databaseUserId });
      return operation(transaction);
    });
  }

  async listByProject(organizationId: string, projectId: string): Promise<ResearchRecord[]> {
    return this.withContext(async (transaction) => {
    const rows = await transaction.$queryRaw<ResearchRow[]>(Prisma.sql`
      SELECT "id", "organizationId", "projectId", "title", "brief", "status", "version", "updatedAt"
      FROM "research"."Research"
      WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId} AND "archivedAt" IS NULL
      ORDER BY "updatedAt" DESC
    `);
    if (!rows.length) return [];
    const queries = await transaction.$queryRaw<QueryRow[]>(Prisma.sql`
      SELECT "id", "researchId", "text", "position"
      FROM "research"."Query"
      WHERE "organizationId" = ${organizationId} AND "projectId" = ${projectId}
      ORDER BY "researchId", "position"
    `);
    return rows.map((row) => toRecord(row, queries));
    });
  }

  async listWorkItems(
    organizationId: string,
    projectId: string,
    query: ResearchListQuery,
  ): Promise<ResearchListResult> {
    const periodDays = query.period === "7d" ? 7 : query.period === "30d" ? 30 : query.period === "90d" ? 90 : null;
    const updatedAfter = periodDays === null ? null : new Date(Date.now() - periodDays * 86_400_000);
    const orderBy = query.sort === "title"
      ? Prisma.sql`research."title" ASC, research."id" ASC`
      : query.sort === "status"
        ? Prisma.sql`research."status" ASC, research."updatedAt" DESC, research."id" ASC`
        : query.sort === "cost"
          ? Prisma.sql`COALESCE(last_run."allocatedCostKopecks", last_run."estimatedCostKopecks", 0) DESC, research."updatedAt" DESC, research."id" ASC`
          : Prisma.sql`research."updatedAt" DESC, research."id" ASC`;
    const status = query.status;
    const offset = (query.page - 1) * query.pageSize;

    return this.withContext(async (transaction) => {
      const where = Prisma.sql`
        research."organizationId" = ${organizationId}
        AND research."projectId" = ${projectId}
        AND research."archivedAt" IS NULL
        AND (${query.search} = '' OR POSITION(LOWER(${query.search}) IN LOWER(research."title")) > 0)
        AND (${status}::text IS NULL OR research."status"::text = ${status})
        AND (${updatedAfter}::timestamptz IS NULL OR research."updatedAt" >= ${updatedAfter})
      `;
      const [rows, totals] = await Promise.all([
        transaction.$queryRaw<ResearchListRow[]>(Prisma.sql`
          SELECT
            research."id", research."organizationId", research."projectId", research."title", research."status"::text,
            research."updatedAt", COUNT(query_row."id")::bigint AS "queryCount",
            last_run."id" AS "lastRunId", last_run."status"::text AS "lastRunStatus",
            last_run."queryCount" AS "lastRunQueryCount",
            last_run."estimatedCostKopecks" AS "lastRunEstimatedCostKopecks",
            last_run."allocatedCostKopecks" AS "lastRunAllocatedCostKopecks",
            last_run."safeErrorCode" AS "lastRunSafeErrorCode",
            last_run."createdAt" AS "lastRunCreatedAt"
          FROM "research"."Research" research
          LEFT JOIN "research"."Query" query_row ON query_row."researchId" = research."id"
          LEFT JOIN LATERAL (
            SELECT run."id", run."status", run."queryCount", run."estimatedCostKopecks", run."allocatedCostKopecks", run."safeErrorCode", run."createdAt"
            FROM "research"."Run" run
            WHERE run."researchId" = research."id" AND run."organizationId" = research."organizationId" AND run."projectId" = research."projectId"
            ORDER BY run."createdAt" DESC, run."id" DESC LIMIT 1
          ) last_run ON TRUE
          WHERE ${where}
          GROUP BY research."id", last_run."id", last_run."status", last_run."queryCount", last_run."estimatedCostKopecks", last_run."allocatedCostKopecks", last_run."safeErrorCode", last_run."createdAt"
          ORDER BY ${orderBy}
          OFFSET ${offset} LIMIT ${query.pageSize}
        `),
        transaction.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS "total" FROM "research"."Research" research WHERE ${where}
        `),
      ]);
      return {
        items: rows.map((row) => ({
          id: row.id,
          organizationId: row.organizationId,
          projectId: row.projectId,
          title: row.title,
          status: row.status,
          queryCount: Number(row.queryCount),
          updatedAt: row.updatedAt.toISOString(),
          lastRun: row.lastRunId && row.lastRunStatus && row.lastRunCreatedAt && row.lastRunQueryCount !== null && row.lastRunEstimatedCostKopecks !== null
            ? {
                runId: row.lastRunId,
                status: row.lastRunStatus,
                queryCount: row.lastRunQueryCount,
                estimatedCostKopecks: row.lastRunEstimatedCostKopecks,
                allocatedCostKopecks: row.lastRunAllocatedCostKopecks,
                safeErrorCode: row.lastRunSafeErrorCode,
                createdAt: row.lastRunCreatedAt.toISOString(),
              }
            : null,
        })),
        total: Number(totals[0]?.total ?? 0),
        page: query.page,
        pageSize: query.pageSize,
      };
    });
  }

  async findById(ref: ResearchRef, store?: DatabaseTransaction): Promise<ResearchRecord | null> {
    const operation = async (transaction: Store) => {
    const rows = await transaction.$queryRaw<ResearchRow[]>(Prisma.sql`
      SELECT "id", "organizationId", "projectId", "title", "brief", "status", "version", "updatedAt"
      FROM "research"."Research"
      WHERE "id" = ${ref.researchId} AND "organizationId" = ${ref.organizationId} AND "projectId" = ${ref.projectId}
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    const queries = await transaction.$queryRaw<QueryRow[]>(Prisma.sql`
      SELECT "id", "researchId", "text", "position"
      FROM "research"."Query"
      WHERE "researchId" = ${ref.researchId} AND "organizationId" = ${ref.organizationId} AND "projectId" = ${ref.projectId}
      ORDER BY "position"
    `);
    return toRecord(row, queries);
    };
    return store ? operation(store) : this.withContext(operation);
  }

  async listRuns(ref: ResearchRef): Promise<ResearchRunSummary[]> {
    return this.withContext(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<Omit<ResearchRunSummary, "createdAt" | "finishedAt"> & { createdAt: Date; finishedAt: Date | null }>>(Prisma.sql`
        SELECT run."id" AS "runId", run."status"::text, run."queryCount", run."estimatedCostKopecks",
          COALESCE(run."allocatedCostKopecks", (SELECT COALESCE(SUM(query_run."allocatedCostKopecks"), 0)::int FROM "research"."QueryRun" AS query_run WHERE query_run."runId"=run."id")) AS "allocatedCostKopecks",
          run."safeErrorCode", run."createdAt", run."finishedAt",
          (SELECT COUNT(*) FILTER (WHERE query_run."status"='PENDING')::int FROM "research"."QueryRun" AS query_run WHERE query_run."runId"=run."id") AS "pendingCount",
          (SELECT COUNT(*) FILTER (WHERE query_run."status"='RUNNING')::int FROM "research"."QueryRun" AS query_run WHERE query_run."runId"=run."id") AS "runningCount",
          (SELECT COUNT(*) FILTER (WHERE query_run."status"='SUCCEEDED')::int FROM "research"."QueryRun" AS query_run WHERE query_run."runId"=run."id") AS "succeededCount",
          (SELECT COUNT(*) FILTER (WHERE query_run."status"='FAILED')::int FROM "research"."QueryRun" AS query_run WHERE query_run."runId"=run."id") AS "failedCount"
        FROM "research"."Run" AS run
        WHERE run."researchId"=${ref.researchId} AND run."organizationId"=${ref.organizationId} AND run."projectId"=${ref.projectId}
        ORDER BY run."createdAt" DESC
      `);
      return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), finishedAt: row.finishedAt?.toISOString() ?? null }));
    });
  }

  async create(input: CreateResearchInput & { createdByUserId: string; correlationId: string }, transaction: DatabaseTransaction): Promise<ResearchRecord> {
    const researchId = newId();
    await transaction.$executeRaw(Prisma.sql`
        INSERT INTO "research"."Research"
          ("id", "organizationId", "projectId", "title", "brief", "status", "createdByUserId", "version", "createdAt", "updatedAt")
        VALUES
          (${researchId}, ${input.organizationId}, ${input.projectId}, ${input.title}, ${input.brief}, 'DRAFT', ${input.createdByUserId}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    for (const [position, text] of input.queries.entries()) {
      await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "research"."Query" ("id", "organizationId", "projectId", "researchId", "text", "position", "createdAt")
          VALUES (${newId()}, ${input.organizationId}, ${input.projectId}, ${researchId}, ${text}, ${position}, CURRENT_TIMESTAMP)
      `);
    }
    return (await this.findById({ organizationId: input.organizationId, projectId: input.projectId, researchId }, transaction))!;
  }

  async update(input: UpdateResearchInput & { actorId: string; correlationId: string }, transaction: DatabaseTransaction): Promise<ResearchRecord | null> {
    const count = await transaction.$executeRaw(Prisma.sql`
        UPDATE "research"."Research"
        SET "title" = ${input.title}, "brief" = ${input.brief}, "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${input.researchId} AND "organizationId" = ${input.organizationId}
          AND "projectId" = ${input.projectId} AND "version" = ${input.version} AND "archivedAt" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM "research"."Run" AS run
            WHERE run."researchId"=${input.researchId} AND run."organizationId"=${input.organizationId}
              AND run."projectId"=${input.projectId} AND run."status" IN ('AWAITING_CONFIRMATION','QUEUED','RUNNING')
          )
    `);
    if (count !== 1) return null;
    await transaction.$executeRaw(Prisma.sql`
        DELETE FROM "research"."Query"
        WHERE "researchId" = ${input.researchId} AND "organizationId" = ${input.organizationId} AND "projectId" = ${input.projectId}
    `);
    for (const [position, text] of input.queries.entries()) {
      await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "research"."Query" ("id", "organizationId", "projectId", "researchId", "text", "position", "createdAt")
          VALUES (${newId()}, ${input.organizationId}, ${input.projectId}, ${input.researchId}, ${text}, ${position}, CURRENT_TIMESTAMP)
      `);
    }
    return this.findById(input, transaction);
  }

  async archive(ref: ResearchRef & { version: number; actorId: string; correlationId: string }, transaction: DatabaseTransaction): Promise<boolean> {
    const count = await transaction.$executeRaw(Prisma.sql`
        UPDATE "research"."Research"
        SET "status" = 'ARCHIVED', "archivedAt" = CURRENT_TIMESTAMP, "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${ref.researchId} AND "organizationId" = ${ref.organizationId}
          AND "projectId" = ${ref.projectId} AND "version" = ${ref.version} AND "archivedAt" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM "research"."Run" AS run
            WHERE run."researchId"=${ref.researchId} AND run."organizationId"=${ref.organizationId}
              AND run."projectId"=${ref.projectId} AND run."status" IN ('AWAITING_CONFIRMATION','QUEUED','RUNNING')
          )
    `);
    return count === 1;
  }

  async reserveRunEstimate(input: { ref: ResearchRef; idempotencyKey: string; queryCount: number; estimatedCostKopecks: number; now: Date; dailyLimitKopecks: number; monthlyLimitKopecks: number }, transaction: DatabaseTransaction) {
    const runId = newId();
    await transaction.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`research.budget:${input.ref.organizationId}`}, 0))`,
    );
    await transaction.$executeRaw(Prisma.sql`
      UPDATE "research"."QueryRun" AS query_run
      SET "status"='FAILED', "safeErrorCode"='RESEARCH_ESTIMATE_EXPIRED',
        "finishedAt"=${input.now}
      FROM "research"."Run" AS run
      WHERE query_run."runId"=run."id"
        AND query_run."status"='PENDING'
        AND run."organizationId"=${input.ref.organizationId}
        AND run."projectId"=${input.ref.projectId}
        AND run."status"='AWAITING_CONFIRMATION'
        AND run."estimateExpiresAt"<=${input.now}
    `);
    await transaction.$executeRaw(Prisma.sql`
      UPDATE "research"."Run"
      SET "status"='CANCELLED', "safeErrorCode"='RESEARCH_ESTIMATE_EXPIRED',
        "finishedAt"=${input.now}, "updatedAt"=CURRENT_TIMESTAMP
      WHERE "organizationId"=${input.ref.organizationId} AND "projectId"=${input.ref.projectId}
        AND "status"='AWAITING_CONFIRMATION' AND "estimateExpiresAt"<=${input.now}
    `);
    const existing = await transaction.$queryRaw<Array<{ id: string; projectId: string; researchId: string; queryCount: number; estimatedCostKopecks: number; status: ResearchRunStatus; estimateExpiresAt: Date }>>(Prisma.sql`
      SELECT "id", "projectId", "researchId", "queryCount", "estimatedCostKopecks", "status"::text, "estimateExpiresAt"
      FROM "research"."Run"
      WHERE "organizationId" = ${input.ref.organizationId} AND "requestKey" = ${input.idempotencyKey}
      ORDER BY CASE
        WHEN "status"='AWAITING_CONFIRMATION' AND "estimateExpiresAt">${input.now} THEN 0
        WHEN "status" IN ('QUEUED','RUNNING') THEN 1
        ELSE 2
      END, "createdAt" DESC, "id" DESC
      LIMIT 1
    `);
    const previous = existing[0];
    if (previous && (
      previous.projectId !== input.ref.projectId ||
      previous.researchId !== input.ref.researchId ||
      previous.queryCount !== input.queryCount ||
      previous.estimatedCostKopecks !== input.estimatedCostKopecks
    )) {
      throw new ResearchError("RESEARCH_IDEMPOTENCY_CONFLICT");
    }
    const spend = await transaction.$queryRaw<Array<{ dailyKopecks: bigint; monthlyKopecks: bigint }>>(Prisma.sql`
      SELECT * FROM "platform"."research_committed_spend"(
        ${input.ref.organizationId},
        ${input.ref.projectId},
        ${input.now}::timestamptz
      )
    `);
    const dailyCommittedKopecks = Number(spend[0]?.dailyKopecks ?? 0);
    const monthlyCommittedKopecks = Number(spend[0]?.monthlyKopecks ?? 0);
    if (previous?.status === "AWAITING_CONFIRMATION" && previous.estimateExpiresAt > input.now) {
      return { runId: previous.id, dailyCommittedKopecks, monthlyCommittedKopecks };
    }
    if (previous && (["QUEUED", "RUNNING"] as const).includes(previous.status as "QUEUED" | "RUNNING")) {
      throw new ResearchError("RESEARCH_ACTIVE_RUN_EXISTS");
    }
    const attemptIdempotencyKey = previous
      ? deriveResearchEstimateAttemptKey(input.idempotencyKey, runId)
      : input.idempotencyKey;
    if (dailyCommittedKopecks + input.estimatedCostKopecks > input.dailyLimitKopecks) {
      throw new ResearchError("RESEARCH_DAILY_LIMIT_EXCEEDED");
    }
    if (monthlyCommittedKopecks + input.estimatedCostKopecks > input.monthlyLimitKopecks) {
      throw new ResearchError("RESEARCH_MONTHLY_LIMIT_EXCEEDED");
    }
    const inserted = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO "research"."Run"
        ("id", "organizationId", "projectId", "researchId", "status", "queryCount", "estimatedCostKopecks", "estimateExpiresAt", "idempotencyKey", "requestKey", "createdAt", "updatedAt")
      VALUES
        (${runId}, ${input.ref.organizationId}, ${input.ref.projectId}, ${input.ref.researchId}, 'AWAITING_CONFIRMATION', ${input.queryCount}, ${input.estimatedCostKopecks}, ${input.now}::timestamptz + INTERVAL '15 minutes', ${attemptIdempotencyKey}, ${input.idempotencyKey}, ${input.now}, CURRENT_TIMESTAMP)
      RETURNING "id"
    `);
    if (inserted[0]) {
      const snapshotQueries = await transaction.$queryRaw<Array<{ id: string; organizationId: string; projectId: string; text: string; position: number }>>(Prisma.sql`
        SELECT "id", "organizationId", "projectId", "text", "position"
        FROM "research"."Query"
        WHERE "researchId"=${input.ref.researchId}
          AND "organizationId"=${input.ref.organizationId} AND "projectId"=${input.ref.projectId}
        ORDER BY "position"
      `);
      if (snapshotQueries.length !== input.queryCount) throw new Error("RESEARCH_QUERY_SET_CHANGED");
      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO "research"."QueryRun"
          ("id", "organizationId", "projectId", "researchId", "runId", "queryId", "queryText", "queryPosition", "status", "attemptCount")
        VALUES ${Prisma.join(snapshotQueries.map((query) => Prisma.sql`
          (${newId()}, ${query.organizationId}, ${query.projectId}, ${input.ref.researchId}, ${inserted[0]!.id}, ${query.id}, ${query.text}, ${query.position}, 'PENDING', 0)
        `))}
      `);
      return { runId: inserted[0].id, dailyCommittedKopecks, monthlyCommittedKopecks };
    }
    throw new Error("RESEARCH_RUN_ESTIMATE_INSERT_FAILED");
  }

  async confirmRun(input: { ref: ResearchRef; runId: string; expectedEstimatedCostKopecks: number; actorId: string; correlationId: string; now: Date; dailyLimitKopecks: number; monthlyLimitKopecks: number }, transaction: DatabaseTransaction) {
      await transaction.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`research.budget:${input.ref.organizationId}`}, 0))`,
      );
      const runs = await transaction.$queryRaw<Array<{ id: string; estimatedCostKopecks: number }>>(Prisma.sql`
        SELECT "id", "estimatedCostKopecks" FROM "research"."Run"
        WHERE "id"=${input.runId} AND "organizationId"=${input.ref.organizationId}
          AND "projectId"=${input.ref.projectId} AND "researchId"=${input.ref.researchId}
          AND "status"='AWAITING_CONFIRMATION' AND "estimateExpiresAt">${input.now}
        FOR UPDATE
      `);
      const run = runs[0];
      if (!run || run.estimatedCostKopecks !== input.expectedEstimatedCostKopecks) return null;
      const spend = await transaction.$queryRaw<Array<{
        dailyKopecks: bigint;
        monthlyKopecks: bigint;
        currentRunInDailyWindow: boolean;
        currentRunInMonthlyWindow: boolean;
      }>>(Prisma.sql`
        SELECT committed.*,
          current_run."createdAt" >= boundaries."dayStart"
            AS "currentRunInDailyWindow",
          current_run."createdAt" >= boundaries."monthStart"
            AS "currentRunInMonthlyWindow"
        FROM "platform"."research_committed_spend"(
          ${input.ref.organizationId},
          ${input.ref.projectId},
          ${input.now}::timestamptz
        ) AS committed
        CROSS JOIN "platform"."research_budget_boundaries"(${input.now}::timestamptz) AS boundaries
        JOIN "research"."Run" AS current_run ON current_run.id = ${input.runId}
      `);
      const currentSpend = spend[0];
      const dailyKopecks = Number(currentSpend?.dailyKopecks ?? 0)
        - (currentSpend?.currentRunInDailyWindow ? run.estimatedCostKopecks : 0);
      const monthlyKopecks = Number(currentSpend?.monthlyKopecks ?? 0)
        - (currentSpend?.currentRunInMonthlyWindow ? run.estimatedCostKopecks : 0);
      if (dailyKopecks + run.estimatedCostKopecks > input.dailyLimitKopecks) {
        throw new ResearchError("RESEARCH_DAILY_LIMIT_EXCEEDED");
      }
      if (monthlyKopecks + run.estimatedCostKopecks > input.monthlyLimitKopecks) {
        throw new ResearchError("RESEARCH_MONTHLY_LIMIT_EXCEEDED");
      }
      await transaction.$executeRaw(Prisma.sql`
        UPDATE "research"."Run" SET "status"='QUEUED', "approvedCostKopecks"=${run.estimatedCostKopecks},
          "confirmedByUserId"=${input.actorId}, "confirmedAt"=${input.now}, "updatedAt"=CURRENT_TIMESTAMP
        WHERE "id"=${run.id}
      `);
      const outboxEventId = newId();
      // OutboxEvent is a platform-owned delivery record. The versioned payload is
      // the authoritative Tools scope; its legacy SEO organization FK stays null.
      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO "public"."OutboxEvent"
          ("id", "organizationId", "topic", "payload", "status", "attempts", "schemaVersion", "correlationId", "occurredAt", "availableAt", "createdAt", "updatedAt")
        VALUES
          (${outboxEventId}, NULL, 'research.run.v1', ${JSON.stringify({ toolsOrganizationId: input.ref.organizationId, toolsProjectId: input.ref.projectId, researchId: input.ref.researchId, runId: input.runId })}::jsonb, 'PENDING', 0, 1, ${input.correlationId}, ${input.now}, ${input.now}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      return { runId: input.runId, outboxEventId };
  }

  async cancelRun(input: ResearchRef & { runId: string; actorId: string; correlationId: string }, transaction: DatabaseTransaction) {
    const rows = await transaction.$queryRaw<Array<{ status: string }>>(Prisma.sql`
      SELECT "status"::text AS "status" FROM "research"."Run"
      WHERE "id"=${input.runId} AND "organizationId"=${input.organizationId}
        AND "projectId"=${input.projectId} AND "researchId"=${input.researchId}
      FOR UPDATE
    `);
    const run = rows[0];
    if (!run) return "not-found" as const;
    if (run.status === "CANCELLED") return "already-cancelled" as const;
    if (!( ["AWAITING_CONFIRMATION", "QUEUED"] as const).includes(run.status as "AWAITING_CONFIRMATION" | "QUEUED")) return "unsafe-state" as const;
    await transaction.$executeRaw(Prisma.sql`
      UPDATE "research"."QueryRun"
      SET "status"='FAILED', "safeErrorCode"='RESEARCH_CANCELLED_BY_USER', "finishedAt"=CURRENT_TIMESTAMP
      WHERE "runId"=${input.runId} AND "status"='PENDING'
    `);
    await transaction.$executeRaw(Prisma.sql`
      UPDATE "research"."Run"
      SET "status"='CANCELLED', "safeErrorCode"='RESEARCH_CANCELLED_BY_USER',
        "finishedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP
      WHERE "id"=${input.runId}
    `);
    return "cancelled" as const;
  }

  async hasActiveRun(ref: ResearchRef, transaction: DatabaseTransaction) {
    const rows = await transaction.$queryRaw<Array<{ active: boolean }>>(Prisma.sql`
      SELECT EXISTS(
        SELECT 1 FROM "research"."Run"
        WHERE "organizationId"=${ref.organizationId} AND "projectId"=${ref.projectId}
          AND "researchId"=${ref.researchId}
          AND "status" IN ('AWAITING_CONFIRMATION','QUEUED','RUNNING')
      ) AS "active"
    `);
    return rows[0]?.active ?? false;
  }

  async appendAudit(input: { organizationId: string; projectId: string; actorId: string; action: string; entityId: string; correlationId: string; marker: { [key: string]: ResearchAuditJsonValue } }, transaction: DatabaseTransaction) {
    await appendAudit(transaction, input);
  }

}

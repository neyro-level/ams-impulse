import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "../../../generated/prisma/client.ts";
import { getPrismaClient } from "../../../platform/database/prisma/client.ts";
import { setDatabaseAuthorizationContext } from "../../../platform/database/authorization-context.ts";
import type { DatabaseTransaction } from "../../../platform/database/transaction.ts";
import type {
  CreateResearchInput,
  ResearchRecord,
  ResearchRef,
  ResearchRunSummary,
  UpdateResearchInput,
} from "../domain/research.ts";
import type { ResearchRepository } from "../application/ports/research-repository.ts";
import { ResearchError } from "../domain/research.ts";

type Store = PrismaClient | DatabaseTransaction;
type ResearchRow = Omit<ResearchRecord, "queries" | "updatedAt"> & { updatedAt: Date };
type QueryRow = { id: string; researchId: string; text: string; position: number };

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
    marker: Prisma.InputJsonValue;
  },
) {
  await store.$executeRaw(Prisma.sql`
    INSERT INTO "public"."AuditEvent"
      ("id", "productCode", "organizationId", "projectId", "actorType", "actorId", "action", "entityType", "entityId", "beforeMarker", "afterMarker", "source", "correlationId", "createdAt")
    VALUES
      (${randomUUID()}, 'tools', ${input.organizationId}, ${input.projectId}, 'USER', ${input.actorId}, ${input.action}, 'Research', ${input.entityId}, NULL, ${JSON.stringify(input.marker)}::jsonb, 'research', ${input.correlationId}, CURRENT_TIMESTAMP)
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
        SELECT "id" AS "runId", "status"::text, "queryCount", "estimatedCostKopecks", "actualCostKopecks", "safeErrorCode", "createdAt", "finishedAt"
        FROM "research"."Run"
        WHERE "researchId"=${ref.researchId} AND "organizationId"=${ref.organizationId} AND "projectId"=${ref.projectId}
        ORDER BY "createdAt" DESC
      `);
      return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), finishedAt: row.finishedAt?.toISOString() ?? null }));
    });
  }

  async create(input: CreateResearchInput & { createdByUserId: string; correlationId: string }, transaction: DatabaseTransaction): Promise<ResearchRecord> {
    const researchId = randomUUID();
    await transaction.$executeRaw(Prisma.sql`
        INSERT INTO "research"."Research"
          ("id", "organizationId", "projectId", "title", "brief", "status", "createdByUserId", "version", "createdAt", "updatedAt")
        VALUES
          (${researchId}, ${input.organizationId}, ${input.projectId}, ${input.title}, ${input.brief}, 'DRAFT', ${input.createdByUserId}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    for (const [position, text] of input.queries.entries()) {
      await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "research"."Query" ("id", "organizationId", "projectId", "researchId", "text", "position", "createdAt")
          VALUES (${randomUUID()}, ${input.organizationId}, ${input.projectId}, ${researchId}, ${text}, ${position}, CURRENT_TIMESTAMP)
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
    `);
    if (count !== 1) return null;
    await transaction.$executeRaw(Prisma.sql`
        DELETE FROM "research"."Query"
        WHERE "researchId" = ${input.researchId} AND "organizationId" = ${input.organizationId} AND "projectId" = ${input.projectId}
    `);
    for (const [position, text] of input.queries.entries()) {
      await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "research"."Query" ("id", "organizationId", "projectId", "researchId", "text", "position", "createdAt")
          VALUES (${randomUUID()}, ${input.organizationId}, ${input.projectId}, ${input.researchId}, ${text}, ${position}, CURRENT_TIMESTAMP)
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
    `);
    return count === 1;
  }

  async reserveRunEstimate(input: { ref: ResearchRef; idempotencyKey: string; queryCount: number; estimatedCostKopecks: number; now: Date; dailyLimitKopecks: number; monthlyLimitKopecks: number }, transaction: DatabaseTransaction) {
    const runId = randomUUID();
    await transaction.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`research.budget:${input.ref.organizationId}`}, 0))`,
    );
    await transaction.$executeRaw(Prisma.sql`
      UPDATE "research"."Run"
      SET "status"='CANCELLED', "safeErrorCode"='RESEARCH_ESTIMATE_EXPIRED',
        "finishedAt"=${input.now}, "updatedAt"=CURRENT_TIMESTAMP
      WHERE "organizationId"=${input.ref.organizationId} AND "projectId"=${input.ref.projectId}
        AND "status"='AWAITING_CONFIRMATION' AND "estimateExpiresAt"<=${input.now}
    `);
    const existing = await transaction.$queryRaw<Array<{ id: string; projectId: string; researchId: string; queryCount: number; estimatedCostKopecks: number }>>(Prisma.sql`
      SELECT "id", "projectId", "researchId", "queryCount", "estimatedCostKopecks" FROM "research"."Run"
      WHERE "organizationId" = ${input.ref.organizationId} AND "idempotencyKey" = ${input.idempotencyKey}
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
    if (previous) return { runId: previous.id, dailyCommittedKopecks, monthlyCommittedKopecks };
    if (dailyCommittedKopecks + input.estimatedCostKopecks > input.dailyLimitKopecks) {
      throw new ResearchError("RESEARCH_DAILY_LIMIT_EXCEEDED");
    }
    if (monthlyCommittedKopecks + input.estimatedCostKopecks > input.monthlyLimitKopecks) {
      throw new ResearchError("RESEARCH_MONTHLY_LIMIT_EXCEEDED");
    }
    const inserted = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO "research"."Run"
        ("id", "organizationId", "projectId", "researchId", "status", "queryCount", "estimatedCostKopecks", "estimateExpiresAt", "idempotencyKey", "createdAt", "updatedAt")
      VALUES
        (${runId}, ${input.ref.organizationId}, ${input.ref.projectId}, ${input.ref.researchId}, 'AWAITING_CONFIRMATION', ${input.queryCount}, ${input.estimatedCostKopecks}, ${input.now} + INTERVAL '15 minutes', ${input.idempotencyKey}, ${input.now}, CURRENT_TIMESTAMP)
      RETURNING "id"
    `);
    return { runId: inserted[0]!.id, dailyCommittedKopecks, monthlyCommittedKopecks };
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
          current_run."createdAt" >= date_trunc('day', ${input.now}::timestamptz)
            AS "currentRunInDailyWindow",
          current_run."createdAt" >= date_trunc('month', ${input.now}::timestamptz)
            AS "currentRunInMonthlyWindow"
        FROM "platform"."research_committed_spend"(
          ${input.ref.organizationId},
          ${input.ref.projectId},
          ${input.now}::timestamptz
        ) AS committed
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
      const outboxEventId = randomUUID();
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
    const count = await transaction.$executeRaw(Prisma.sql`
      UPDATE "research"."Run"
      SET "status"='CANCELLED', "safeErrorCode"='RESEARCH_CANCELLED_BY_USER',
        "finishedAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP
      WHERE "id"=${input.runId} AND "organizationId"=${input.organizationId}
        AND "projectId"=${input.projectId} AND "researchId"=${input.researchId}
        AND "status" IN ('AWAITING_CONFIRMATION','QUEUED')
    `);
    if (count !== 1) return false;
    return true;
  }

  async appendAudit(input: { organizationId: string; projectId: string; actorId: string; action: string; entityId: string; correlationId: string; marker: Prisma.InputJsonValue }, transaction: DatabaseTransaction) {
    await appendAudit(transaction, input);
  }
}

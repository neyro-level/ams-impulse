import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

import { PrismaAccessGrantRepository } from "../src/modules/identity-access/server.ts";
import type { PrivateExportStorage } from "../src/modules/research/index.ts";
import { PrismaResearchReportRepository, PrismaResearchRepository, ResearchReportService, ResearchService } from "../src/modules/research/server.ts";
import { AuthorizationService } from "../src/platform/authorization/authorization-service.ts";
import type { PlatformAnalystPrincipal } from "../src/platform/authorization/principal.ts";
import { createPrismaContext, type PrismaContext } from "../src/platform/database/prisma/context.ts";

const integrationEnabled = Boolean(
  process.env.DATABASE_HOST
    && process.env.DATABASE_USER
    && process.env.DATABASE_PASSWORD
    && process.env.DATABASE_NAME,
);
const integrationDescription = integrationEnabled ? describe : describe.skip;
const prefix = "research-concurrency-proof";
const correlationId = "00000000-0000-4000-8000-000000000104";
const proofNow = new Date();
const ids = {
  user: `${prefix}-user`,
  organization: `${prefix}-org`,
  project: `${prefix}-project`,
  membership: `${prefix}-membership`,
  access: `${prefix}-access`,
  research: `${prefix}-research`,
  query: `${prefix}-query`,
} as const;
const principal: PlatformAnalystPrincipal = {
  kind: "platform-analyst",
  userId: ids.user,
  correlationId,
};

async function removeFixture(database: PrismaContext) {
  await database.pool.query(
    `DELETE FROM "public"."OutboxEvent"
     WHERE "topic" = 'research.run.v1' AND "payload"->>'researchId' = $1`,
    [ids.research],
  );
  await database.pool.query('DELETE FROM "public"."AuditEvent" WHERE "correlationId" = $1', [correlationId]);
  await database.pool.query('DELETE FROM "research"."Export" WHERE "researchId" = $1', [ids.research]);
  await database.pool.query('DELETE FROM "research"."Run" WHERE "researchId" = $1', [ids.research]);
  await database.pool.query('DELETE FROM "research"."Query" WHERE "researchId" = $1', [ids.research]);
  await database.pool.query('DELETE FROM "research"."Research" WHERE "id" = $1', [ids.research]);
  await database.pool.query('DELETE FROM "tools"."ToolsProjectAccess" WHERE "id" = $1', [ids.access]);
  await database.pool.query('DELETE FROM "tools"."ToolsMembership" WHERE "id" = $1', [ids.membership]);
  await database.pool.query('DELETE FROM "tools"."ToolsProject" WHERE "id" = $1', [ids.project]);
  await database.pool.query('DELETE FROM "tools"."ToolsOrganization" WHERE "id" = $1', [ids.organization]);
  await database.prisma.user.deleteMany({ where: { id: ids.user } });
}

integrationDescription("Research budget concurrency and idempotency", () => {
  let database: PrismaContext;
  let research: ResearchService;
  let reports: ResearchReportService;
  const uploadedObjectKeys: string[] = [];

  beforeAll(async () => {
    database = createPrismaContext({
      DATABASE_HOST: process.env.DATABASE_HOST,
      DATABASE_PORT: process.env.DATABASE_PORT,
      DATABASE_USER: process.env.DATABASE_USER,
      DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
      DATABASE_NAME: process.env.DATABASE_NAME,
      DATABASE_SSLMODE: process.env.DATABASE_SSLMODE,
    });
    await removeFixture(database);
    await database.prisma.user.create({
      data: {
        id: ids.user,
        email: `${prefix}@example.invalid`,
        name: "Research concurrency analyst",
        systemRole: "ANALYST",
      },
    });
    await database.pool.query(
      `INSERT INTO "tools"."ToolsOrganization" ("id", "slug", "name") VALUES ($1, $2, 'Organization')`,
      [ids.organization, prefix],
    );
    await database.pool.query(
      `INSERT INTO "tools"."ToolsProject" ("id", "organizationId", "slug", "name") VALUES ($1, $2, 'project', 'Project')`,
      [ids.project, ids.organization],
    );
    await database.pool.query(
      `INSERT INTO "tools"."ToolsMembership" ("id", "organizationId", "userId") VALUES ($1, $2, $3)`,
      [ids.membership, ids.organization, ids.user],
    );
    await database.pool.query(
      `INSERT INTO "tools"."ToolsProjectAccess" ("id", "membershipId", "organizationId", "projectId", "role")
       VALUES ($1, $2, $3, $4, 'ANALYST')`,
      [ids.access, ids.membership, ids.organization, ids.project],
    );
    await database.pool.query(
      `INSERT INTO "research"."Research"
        ("id", "organizationId", "projectId", "title", "brief", "createdByUserId")
       VALUES ($1, $2, $3, 'Concurrency proof', '', $4)`,
      [ids.research, ids.organization, ids.project, ids.user],
    );
    await database.pool.query(
      `INSERT INTO "research"."Query"
        ("id", "organizationId", "projectId", "researchId", "text", "position")
       VALUES ($1, $2, $3, $4, 'synthetic query', 0)`,
      [ids.query, ids.organization, ids.project, ids.research],
    );

    const authorization = new AuthorizationService(
      new PrismaAccessGrantRepository(database.prisma),
    );
    research = new ResearchService(
      new PrismaResearchRepository(ids.user, database.prisma),
      authorization,
      { estimateRunCostKopecks: () => 100 },
      { dailyLimitKopecks: 50_000, monthlyLimitKopecks: 300_000 },
      () => proofNow,
    );
    const storage: PrivateExportStorage = {
      async putCsv(objectKey) {
        uploadedObjectKeys.push(objectKey);
      },
      async createDownloadUrl() {
        return "https://storage.example.invalid/signed";
      },
    };
    reports = new ResearchReportService(
      new PrismaResearchReportRepository(ids.user, database.prisma),
      authorization,
      storage,
    );
  });

  beforeEach(async () => {
    uploadedObjectKeys.length = 0;
    await database.pool.query(
      `DELETE FROM "public"."OutboxEvent"
       WHERE "topic" = 'research.run.v1' AND "payload"->>'researchId' = $1`,
      [ids.research],
    );
    await database.pool.query('DELETE FROM "public"."AuditEvent" WHERE "correlationId" = $1', [correlationId]);
    await database.pool.query('DELETE FROM "research"."Export" WHERE "researchId" = $1', [ids.research]);
    await database.pool.query('DELETE FROM "research"."Run" WHERE "researchId" = $1', [ids.research]);
  });

  afterAll(async () => {
    await removeFixture(database);
    await database.close();
  });

  function ref() {
    return {
      organizationId: ids.organization,
      projectId: ids.project,
      researchId: ids.research,
    };
  }

  it("serializes parallel estimates so reserved spend cannot exceed the daily limit", async () => {
    await database.pool.query(
      `INSERT INTO "research"."Run"
        ("id", "organizationId", "projectId", "researchId", "status", "queryCount",
         "estimatedCostKopecks", "estimateExpiresAt", "approvedCostKopecks",
         "idempotencyKey", "confirmedAt")
       VALUES ($1, $2, $3, $4, 'QUEUED', 1, 49900, CURRENT_TIMESTAMP + INTERVAL '1 hour',
         49900, $5, $6)`,
      [`${prefix}-baseline`, ids.organization, ids.project, ids.research, `${prefix}:baseline`, proofNow],
    );
    const estimates = await Promise.allSettled([
      research.estimateRun(principal, { ...ref(), idempotencyKey: `${prefix}:estimate-a` }),
      research.estimateRun(principal, { ...ref(), idempotencyKey: `${prefix}:estimate-b` }),
    ]);
    const accepted = estimates.find(({ status }) => status === "fulfilled");
    expect(accepted).toMatchObject({
      status: "fulfilled",
      value: { dailyCommittedKopecks: 49_900, estimatedCostKopecks: 100 },
    });
    const rejected = estimates.find(({ status }) => status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: { code: "RESEARCH_DAILY_LIMIT_EXCEEDED" },
    });
    if (!accepted || accepted.status !== "fulfilled") throw new Error("Expected one accepted estimate");
    await research.confirmAndQueue(principal, {
      ...ref(),
      runId: accepted.value.runId,
      expectedEstimatedCostKopecks: 100,
    });
    const state = await database.pool.query<{ status: string; count: string }>(
      `SELECT "status"::text, COUNT(*)::text AS count FROM "research"."Run"
       WHERE "researchId" = $1 GROUP BY "status" ORDER BY "status"`,
      [ids.research],
    );
    expect(state.rows).toEqual([{ status: "QUEUED", count: "2" }]);
  });

  it("queues one outbox event when the same run is confirmed twice", async () => {
    const estimate = await research.estimateRun(principal, {
      ...ref(),
      idempotencyKey: `${prefix}:same-confirmation`,
    });
    const confirmations = await Promise.allSettled([
      research.confirmAndQueue(principal, {
        ...ref(), runId: estimate.runId, expectedEstimatedCostKopecks: 100,
      }),
      research.confirmAndQueue(principal, {
        ...ref(), runId: estimate.runId, expectedEstimatedCostKopecks: 100,
      }),
    ]);
    expect(confirmations.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(confirmations.filter(({ status }) => status === "rejected")).toHaveLength(1);
    const outbox = await database.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "public"."OutboxEvent"
       WHERE "topic" = 'research.run.v1' AND "payload"->>'runId' = $1`,
      [estimate.runId],
    );
    expect(outbox.rows[0]?.count).toBe("1");
  });

  it("reserves one export for parallel requests with the same idempotency key", async () => {
    const runId = `${prefix}-succeeded-run`;
    await database.pool.query(
      `INSERT INTO "research"."Run"
        ("id", "organizationId", "projectId", "researchId", "status", "queryCount",
         "estimatedCostKopecks", "estimateExpiresAt", "approvedCostKopecks",
         "actualCostKopecks", "idempotencyKey", "confirmedAt", "finishedAt")
       VALUES ($1, $2, $3, $4, 'SUCCEEDED', 1, 100, CURRENT_TIMESTAMP + INTERVAL '1 hour',
         100, 100, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [runId, ids.organization, ids.project, ids.research, `${prefix}:succeeded`],
    );
    const input = {
      ...ref(),
      runId,
      idempotencyKey: `${prefix}:same-export`,
    };
    const exports = await Promise.all([
      reports.createExport(principal, input),
      reports.createExport(principal, input),
    ]);
    expect(new Set(exports.map(({ exportId }) => exportId)).size).toBe(1);
    expect(uploadedObjectKeys).toHaveLength(1);
    expect(new Set(uploadedObjectKeys).size).toBe(1);
    const rows = await database.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "research"."Export"
       WHERE "organizationId" = $1 AND "idempotencyKey" = $2`,
      [ids.organization, input.idempotencyKey],
    );
    expect(rows.rows[0]?.count).toBe("1");
  });
});

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaAccessGrantRepository } from "../src/modules/identity-access/server.ts";
import type { PrivateExportStorage } from "../src/modules/research/index.ts";
import { createResearchMcpServer, PrismaResearchReportRepository, PrismaResearchRepository, ResearchReportService, ResearchService } from "../src/modules/research/server.ts";
import { AuthorizationService } from "../src/platform/authorization/authorization-service.ts";
import { createPrismaContext, type PrismaContext } from "../src/platform/database/prisma/context.ts";
import { createPlatformAnalystPrincipal } from "./helpers/principal.ts";

const integrationEnabled = Boolean(
  process.env.DATABASE_HOST
    && process.env.DATABASE_USER
    && process.env.DATABASE_PASSWORD
    && process.env.DATABASE_NAME,
);
const integrationDescription = integrationEnabled ? describe : describe.skip;
const prefix = "research-isolation-proof";
const ids = {
  user: `${prefix}-user`,
  organizationA: `${prefix}-org-a`,
  organizationB: `${prefix}-org-b`,
  projectA: `${prefix}-project-a`,
  projectB: `${prefix}-project-b`,
  projectC: `${prefix}-project-c`,
  membershipA: `${prefix}-membership-a`,
  accessA: `${prefix}-access-a`,
  researchA: `${prefix}-research-a`,
  researchB: `${prefix}-research-b`,
  researchC: `${prefix}-research-c`,
  queryA: `${prefix}-query-a`,
  queryB: `${prefix}-query-b`,
  queryC: `${prefix}-query-c`,
  runA: `${prefix}-run-a`,
  runB: `${prefix}-run-b`,
  runC: `${prefix}-run-c`,
  exportA: `${prefix}-export-a`,
  exportB: `${prefix}-export-b`,
  exportC: `${prefix}-export-c`,
} as const;

const principal = createPlatformAnalystPrincipal(ids.user);
const storage: PrivateExportStorage = {
  async putCsv() {},
  async createDownloadUrl(objectKey) {
    return `https://storage.example.invalid/${encodeURIComponent(objectKey)}`;
  },
};

async function removeFixture(database: PrismaContext) {
  await database.pool.query('DELETE FROM "research"."Export" WHERE "id" LIKE $1', [`${prefix}%`]);
  await database.pool.query('DELETE FROM "research"."Run" WHERE "id" LIKE $1', [`${prefix}%`]);
  await database.pool.query('DELETE FROM "research"."Query" WHERE "id" LIKE $1', [`${prefix}%`]);
  await database.pool.query('DELETE FROM "research"."Research" WHERE "id" LIKE $1', [`${prefix}%`]);
  await database.pool.query('DELETE FROM "tools"."ToolsProjectAccess" WHERE "id" LIKE $1', [`${prefix}%`]);
  await database.pool.query('DELETE FROM "tools"."ToolsMembership" WHERE "id" LIKE $1', [`${prefix}%`]);
  await database.pool.query('DELETE FROM "tools"."ToolsProject" WHERE "id" LIKE $1', [`${prefix}%`]);
  await database.pool.query('DELETE FROM "tools"."ToolsOrganization" WHERE "id" LIKE $1', [`${prefix}%`]);
  await database.prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
}

integrationDescription("Research tenant and project isolation", () => {
  let database: PrismaContext;
  let research: ResearchService;
  let reports: ResearchReportService;

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
        name: "Research isolation analyst",
        systemRole: "ANALYST",
      },
    });
    await database.pool.query(
      `INSERT INTO "tools"."ToolsOrganization" ("id", "slug", "name") VALUES
        ($1, $2, 'Organization A'), ($3, $4, 'Organization B')`,
      [ids.organizationA, `${prefix}-a`, ids.organizationB, `${prefix}-b`],
    );
    await database.pool.query(
      `INSERT INTO "tools"."ToolsProject" ("id", "organizationId", "slug", "name") VALUES
        ($1, $2, 'a', 'Project A'), ($3, $2, 'b', 'Project B'), ($4, $5, 'c', 'Project C')`,
      [ids.projectA, ids.organizationA, ids.projectB, ids.projectC, ids.organizationB],
    );
    await database.pool.query(
      `INSERT INTO "tools"."ToolsMembership" ("id", "organizationId", "userId") VALUES ($1, $2, $3)`,
      [ids.membershipA, ids.organizationA, ids.user],
    );
    await database.pool.query(
      `INSERT INTO "tools"."ToolsProjectAccess" ("id", "membershipId", "organizationId", "projectId", "role")
       VALUES ($1, $2, $3, $4, 'ANALYST')`,
      [ids.accessA, ids.membershipA, ids.organizationA, ids.projectA],
    );

    for (const [researchId, organizationId, projectId, queryId, runId, exportId] of [
      [ids.researchA, ids.organizationA, ids.projectA, ids.queryA, ids.runA, ids.exportA],
      [ids.researchB, ids.organizationA, ids.projectB, ids.queryB, ids.runB, ids.exportB],
      [ids.researchC, ids.organizationB, ids.projectC, ids.queryC, ids.runC, ids.exportC],
    ] as const) {
      await database.pool.query(
        `INSERT INTO "research"."Research"
          ("id", "organizationId", "projectId", "title", "brief", "status", "createdByUserId")
         VALUES ($1, $2, $3, $4, '', 'SUCCEEDED', $5)`,
        [researchId, organizationId, projectId, researchId, ids.user],
      );
      await database.pool.query(
        `INSERT INTO "research"."Query"
          ("id", "organizationId", "projectId", "researchId", "text", "position")
         VALUES ($1, $2, $3, $4, 'synthetic query', 0)`,
        [queryId, organizationId, projectId, researchId],
      );
      await database.pool.query(
        `INSERT INTO "research"."Run"
          ("id", "organizationId", "projectId", "researchId", "status", "queryCount",
           "estimatedCostKopecks", "estimateExpiresAt", "approvedCostKopecks",
           "allocatedCostKopecks", "idempotencyKey", "requestKey", "finishedAt")
         VALUES ($1, $2, $3, $4, 'SUCCEEDED', 1, 100, CURRENT_TIMESTAMP + INTERVAL '1 hour',
           100, 100, $5, $5, CURRENT_TIMESTAMP)`,
        [runId, organizationId, projectId, researchId, `${prefix}:${runId}`],
      );
      await database.pool.query(
        `INSERT INTO "research"."Export"
          ("id", "organizationId", "projectId", "researchId", "runId", "format", "status",
           "objectKey", "createdByUserId", "expiresAt", "idempotencyKey")
         VALUES ($1, $2, $3, $4, $5, 'csv', 'READY', $6, $7,
           CURRENT_TIMESTAMP + INTERVAL '1 hour', $8)`,
        [
          exportId,
          organizationId,
          projectId,
          researchId,
          runId,
          `research/${organizationId}/${projectId}/${researchId}/${exportId}.csv`,
          ids.user,
          `${prefix}:${exportId}`,
        ],
      );
    }

    const authorization = new AuthorizationService(
      new PrismaAccessGrantRepository(database.prisma),
    );
    research = new ResearchService(
      new PrismaResearchRepository(ids.user, database.prisma),
      authorization,
      { estimateRunCostKopecks: () => 100 },
      { dailyLimitKopecks: 50_000, monthlyLimitKopecks: 300_000 },
    );
    reports = new ResearchReportService(
      new PrismaResearchReportRepository(ids.user, database.prisma),
      authorization,
      storage,
    );
  });

  afterAll(async () => {
    await removeFixture(database);
    await database.close();
  });

  it("allows project A queries but denies sibling and foreign-organization projects", async () => {
    await expect(research.list(principal, ids.organizationA, ids.projectA)).resolves.toMatchObject([
      { id: ids.researchA, organizationId: ids.organizationA, projectId: ids.projectA },
    ]);
    await expect(research.get(principal, {
      organizationId: ids.organizationA,
      projectId: ids.projectB,
      researchId: ids.researchB,
    })).rejects.toMatchObject({ code: "RESEARCH_NOT_FOUND_OR_FORBIDDEN" });
    await expect(research.get(principal, {
      organizationId: ids.organizationB,
      projectId: ids.projectC,
      researchId: ids.researchC,
    })).rejects.toMatchObject({ code: "RESEARCH_NOT_FOUND_OR_FORBIDDEN" });
    await expect(research.get(principal, {
      organizationId: ids.organizationA,
      projectId: ids.projectA,
      researchId: `${prefix}-guessed-research`,
    })).rejects.toMatchObject({ code: "RESEARCH_NOT_FOUND_OR_FORBIDDEN" });
  });

  it("does not mutate sibling, foreign-organization, or guessed research IDs", async () => {
    for (const ref of [
      { organizationId: ids.organizationA, projectId: ids.projectB, researchId: ids.researchB },
      { organizationId: ids.organizationB, projectId: ids.projectC, researchId: ids.researchC },
      { organizationId: ids.organizationA, projectId: ids.projectA, researchId: `${prefix}-guessed-research` },
    ]) {
      await expect(research.update(principal, {
        ...ref,
        title: "Substituted",
        brief: "",
        queries: ["synthetic query"],
        version: 1,
      })).rejects.toMatchObject({ code: "RESEARCH_NOT_FOUND_OR_FORBIDDEN" });
    }

    const foreign = await database.pool.query<{ title: string }>(
      'SELECT "title" FROM "research"."Research" WHERE "id" = $1',
      [ids.researchB],
    );
    expect(foreign.rows[0]?.title).toBe(ids.researchB);
  });

  it("returns the same safe MCP error for guessed research and run IDs", async () => {
    const server = createResearchMcpServer({ principal, research, reports });
    const client = new Client({ name: "research-isolation-proof", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      for (const ref of [
        { organizationId: ids.organizationA, projectId: ids.projectB, researchId: ids.researchB, runId: ids.runB },
        { organizationId: ids.organizationB, projectId: ids.projectC, researchId: ids.researchC, runId: ids.runC },
        { organizationId: ids.organizationA, projectId: ids.projectA, researchId: ids.researchA, runId: `${prefix}-guessed-run` },
      ]) {
        const result = await client.callTool({
          name: "research_get_run",
          arguments: ref,
        });
        expect(result.isError).toBe(true);
        expect(result.content).toHaveLength(1);
        const content = result.content[0];
        expect(content).toMatchObject({ type: "text" });
        const envelope = JSON.parse(content && "text" in content ? content.text : "{}");
        expect(envelope).toMatchObject({
          ok: false,
          error: {
            code: "RESEARCH_NOT_FOUND_OR_FORBIDDEN",
            fieldErrors: {},
            correlationId: expect.any(String),
          },
        });
        expect(JSON.stringify(envelope)).not.toContain(ids.organizationB);
        expect(JSON.stringify(envelope)).not.toContain(ids.projectC);
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("does not issue a download URL for a guessed foreign export ID", async () => {
    for (const ref of [
      { organizationId: ids.organizationA, projectId: ids.projectB, researchId: ids.researchB, exportId: ids.exportB },
      { organizationId: ids.organizationB, projectId: ids.projectC, researchId: ids.researchC, exportId: ids.exportC },
      { organizationId: ids.organizationA, projectId: ids.projectA, researchId: ids.researchA, exportId: `${prefix}-guessed-export` },
    ]) {
      await expect(reports.createDownload(principal, ref)).rejects.toMatchObject({
        code: "RESEARCH_NOT_FOUND_OR_FORBIDDEN",
      });
    }
    await expect(reports.createDownload(principal, {
      organizationId: ids.organizationA,
      projectId: ids.projectA,
      researchId: ids.researchA,
      exportId: ids.exportA,
    })).resolves.toMatchObject({ expiresInSeconds: 60 });
  });
});

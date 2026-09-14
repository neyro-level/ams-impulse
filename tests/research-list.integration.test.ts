import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { Prisma, PrismaClient, SystemRole } from "../src/generated/prisma/client.ts";
import { PrismaResearchRepository } from "../src/modules/research/infrastructure/prisma-research-repository.ts";
import { createPgPoolConfigFromEnvironment } from "../src/platform/database/prisma/pool-config.ts";

const ids = {
  user: "research-list-user",
  organization: "research-list-org",
  project: "research-list-project",
  membership: "research-list-membership",
  access: "research-list-access",
  research: "research-list-record",
  query: "research-list-query",
  run: "research-list-run",
  latestRun: "research-list-run-z",
};

let pool: Pool;
let prisma: PrismaClient;

describe("Research operational list", () => {
  beforeAll(async () => {
    pool = new Pool(createPgPoolConfigFromEnvironment(process.env));
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    await prisma.user.upsert({
      where: { id: ids.user },
      update: { disabledAt: null },
      create: { id: ids.user, name: "Research list", email: "research-list@example.test", emailVerified: true, systemRole: SystemRole.ANALYST },
    });
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`INSERT INTO "tools"."ToolsOrganization" ("id", "slug", "name") VALUES (${ids.organization}, 'research-list-org', 'Research list org') ON CONFLICT ("id") DO NOTHING`);
      await transaction.$executeRaw(Prisma.sql`INSERT INTO "tools"."ToolsProject" ("id", "organizationId", "slug", "name") VALUES (${ids.project}, ${ids.organization}, 'research-list-project', 'Research list project') ON CONFLICT ("id") DO NOTHING`);
      await transaction.$executeRaw(Prisma.sql`INSERT INTO "tools"."ToolsMembership" ("id", "organizationId", "userId") VALUES (${ids.membership}, ${ids.organization}, ${ids.user}) ON CONFLICT ("id") DO NOTHING`);
      await transaction.$executeRaw(Prisma.sql`INSERT INTO "tools"."ToolsProjectAccess" ("id", "membershipId", "organizationId", "projectId", "role") VALUES (${ids.access}, ${ids.membership}, ${ids.organization}, ${ids.project}, 'ANALYST') ON CONFLICT ("id") DO NOTHING`);
      await transaction.$executeRaw(Prisma.sql`INSERT INTO "research"."Research" ("id", "organizationId", "projectId", "title", "createdByUserId", "status") VALUES (${ids.research}, ${ids.organization}, ${ids.project}, 'Офисный рынок', ${ids.user}, 'READY') ON CONFLICT ("id") DO NOTHING`);
      await transaction.$executeRaw(Prisma.sql`INSERT INTO "research"."Query" ("id", "organizationId", "projectId", "researchId", "text", "position") VALUES (${ids.query}, ${ids.organization}, ${ids.project}, ${ids.research}, 'офисы', 0) ON CONFLICT ("id") DO NOTHING`);
      await transaction.$executeRaw(Prisma.sql`INSERT INTO "research"."Run" ("id", "organizationId", "projectId", "researchId", "status", "queryCount", "estimatedCostKopecks", "allocatedCostKopecks", "estimateExpiresAt", "idempotencyKey", "requestKey") VALUES (${ids.run}, ${ids.organization}, ${ids.project}, ${ids.research}, 'SUCCEEDED', 1, 125, 120, CURRENT_TIMESTAMP + INTERVAL '15 minutes', 'research-list-run-key', 'research-list-run-key') ON CONFLICT ("id") DO NOTHING`);
      await transaction.$executeRaw(Prisma.sql`INSERT INTO "research"."Run" ("id", "organizationId", "projectId", "researchId", "status", "queryCount", "estimatedCostKopecks", "allocatedCostKopecks", "estimateExpiresAt", "idempotencyKey", "requestKey", "createdAt") SELECT ${ids.latestRun}, ${ids.organization}, ${ids.project}, ${ids.research}, 'SUCCEEDED', 1, 135, 130, CURRENT_TIMESTAMP + INTERVAL '15 minutes', 'research-list-latest-run-key', 'research-list-latest-run-key', "createdAt" FROM "research"."Run" WHERE "id" = ${ids.run} ON CONFLICT ("id") DO NOTHING`);
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`DELETE FROM "research"."Run" WHERE "organizationId"=${ids.organization}`);
      await transaction.$executeRaw(Prisma.sql`DELETE FROM "research"."Research" WHERE "organizationId"=${ids.organization}`);
      await transaction.$executeRaw(Prisma.sql`DELETE FROM "tools"."ToolsProject" WHERE "organizationId"=${ids.organization}`);
      await transaction.$executeRaw(Prisma.sql`DELETE FROM "tools"."ToolsOrganization" WHERE "id"=${ids.organization}`);
    });
    await prisma.user.deleteMany({ where: { id: ids.user } });
    await prisma.$disconnect();
    await pool.end();
  });

  it("filters, counts queries and returns persisted last-run cost", async () => {
    const result = await new PrismaResearchRepository(ids.user, prisma).listWorkItems(ids.organization, ids.project, {
      page: 1,
      pageSize: 20,
      search: "офис",
      status: "READY",
      period: "30d",
      sort: "cost",
    });
    expect(result).toMatchObject({
      total: 1,
      items: [{ id: ids.research, queryCount: 1, lastRun: { runId: ids.latestRun, allocatedCostKopecks: 130 } }],
    });
  });
});

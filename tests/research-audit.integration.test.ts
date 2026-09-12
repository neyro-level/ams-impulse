import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "../src/generated/prisma/client.ts";
import { ResearchService } from "../src/modules/research/application/research-service.ts";
import { PrismaResearchRepository } from "../src/modules/research/infrastructure/prisma-research-repository.ts";
import { AuthorizationService } from "../src/platform/authorization/authorization-service.ts";
import { createPgPoolConfigFromEnvironment } from "../src/platform/database/prisma/pool-config.ts";

const integrationEnabled = Boolean(
  process.env.TEST_DATABASE_HOST &&
    process.env.TEST_DATABASE_USER &&
    process.env.TEST_DATABASE_PASSWORD &&
    process.env.TEST_DATABASE_NAME,
);
const integrationDescription = integrationEnabled ? describe : describe.skip;
const suffix = "research-audit-integration";
const userId = `${suffix}-user`;
const organizationId = `${suffix}-organization`;
const projectId = `${suffix}-project`;
const correlationId = "00000000-0000-4000-8000-000000000201";

integrationDescription("Research audit tenant scope", () => {
  let prisma: PrismaClient;
  let pool: Pool;

  async function cleanup() {
    await prisma.jobRun.deleteMany({ where: { correlationId } });
    await prisma.auditEvent.deleteMany({ where: { correlationId } });
    await prisma.outboxEvent.deleteMany({ where: { correlationId } });
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "research"."Export" WHERE "organizationId" = ${organizationId}`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "research"."Evidence" WHERE "organizationId" = ${organizationId}`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "research"."CompetitorProjection" WHERE "organizationId" = ${organizationId}`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "research"."QueryRun" WHERE "organizationId" = ${organizationId}`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "research"."Run" WHERE "organizationId" = ${organizationId}`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "research"."Query" WHERE "organizationId" = ${organizationId}`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "research"."Research" WHERE "organizationId" = ${organizationId}`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "tools"."ToolsProjectAccess" WHERE "organizationId" = ${organizationId}`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "tools"."ToolsMembership" WHERE "organizationId" = ${organizationId}`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "tools"."ToolsProject" WHERE "organizationId" = ${organizationId}`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "tools"."ToolsOrganization" WHERE "id" = ${organizationId}`);
    await prisma.user.deleteMany({ where: { id: userId } });
  }

  beforeAll(async () => {
    pool = new Pool(
      createPgPoolConfigFromEnvironment({
        DATABASE_HOST: process.env.TEST_DATABASE_HOST,
        DATABASE_PORT: process.env.TEST_DATABASE_PORT,
        DATABASE_USER: process.env.TEST_DATABASE_USER,
        DATABASE_PASSWORD: process.env.TEST_DATABASE_PASSWORD,
        DATABASE_NAME: process.env.TEST_DATABASE_NAME,
        DATABASE_SSLMODE: process.env.TEST_DATABASE_SSLMODE,
      }),
    );
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    await cleanup();
    await prisma.user.create({
      data: {
        id: userId,
        name: "Research audit integration user",
        email: `${suffix}@example.test`,
        emailVerified: true,
        systemRole: "PLATFORM_ADMIN",
      },
    });
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "tools"."ToolsOrganization" ("id", "slug", "name")
      VALUES (${organizationId}, ${suffix}, 'Research audit integration organization')
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "tools"."ToolsProject" ("id", "organizationId", "slug", "name")
      VALUES (${projectId}, ${organizationId}, ${suffix}, 'Research audit integration project')
    `);
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
    await pool.end();
  });

  it("stores Tools scope in audit while keeping OutboxEvent platform-owned", async () => {
    const repository = new PrismaResearchRepository(userId, prisma);
    const now = new Date();
    const principal = {
      kind: "platform-admin" as const,
      userId,
      correlationId,
    };
    const service = new ResearchService(
      repository,
      new AuthorizationService({ async listProjectGrants() { return []; } }),
      { estimateRunCostKopecks: () => 100 },
      { dailyLimitKopecks: 50_000, monthlyLimitKopecks: 300_000 },
      () => now,
    );
    const research = await service.create(principal, {
      organizationId,
      projectId,
      title: "Tenant-aware audit",
      brief: "",
      queries: ["tenant scope proof"],
    });
    const estimate = await service.estimateRun(principal, {
      organizationId,
      projectId,
      researchId: research.id,
    });
    const confirmed = await service.confirmAndQueue(principal, {
      organizationId,
      projectId,
      researchId: research.id,
      runId: estimate.runId,
      expectedEstimatedCostKopecks: 100,
    });

    expect(confirmed).not.toBeNull();
    const audits = await prisma.auditEvent.findMany({
      where: { correlationId, source: "research" },
      orderBy: { createdAt: "asc" },
      select: { productCode: true, organizationId: true, projectId: true, action: true },
    });
    expect(audits).toEqual([
      { productCode: "tools", organizationId, projectId, action: "research.create" },
      { productCode: "tools", organizationId, projectId, action: "research.run.estimate" },
      { productCode: "tools", organizationId, projectId, action: "research.run.confirm" },
    ]);

    const outbox = await prisma.outboxEvent.findUniqueOrThrow({
      where: { id: confirmed!.outboxEventId },
      select: { organizationId: true, payload: true },
    });
    expect(outbox.organizationId).toBeNull();
    expect(outbox.payload).toMatchObject({
      toolsOrganizationId: organizationId,
      toolsProjectId: projectId,
      researchId: research.id,
      runId: estimate.runId,
    });
  });
});

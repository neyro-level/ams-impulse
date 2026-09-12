import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaAccessGrantRepository } from "../src/modules/identity-access/server.ts";
import { PrismaResearchRepository, ResearchService } from "../src/modules/research/server.ts";
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
const prefix = "research-audit-safety-proof";
const ids = {
  user: `${prefix}-user`,
  organization: `${prefix}-organization`,
  project: `${prefix}-project`,
  membership: `${prefix}-membership`,
  access: `${prefix}-access`,
} as const;
const correlationId = "00000000-0000-4000-8000-000000000106";

async function cleanup(database: PrismaContext) {
  await database.pool.query('DELETE FROM "public"."AuditEvent" WHERE "correlationId" = $1', [correlationId]);
  await database.pool.query('DELETE FROM "research"."Query" WHERE "organizationId" = $1', [ids.organization]);
  await database.pool.query('DELETE FROM "research"."Research" WHERE "organizationId" = $1', [ids.organization]);
  await database.pool.query('DELETE FROM "tools"."ToolsProjectAccess" WHERE "id" = $1', [ids.access]);
  await database.pool.query('DELETE FROM "tools"."ToolsMembership" WHERE "id" = $1', [ids.membership]);
  await database.pool.query('DELETE FROM "tools"."ToolsProject" WHERE "organizationId" = $1', [ids.organization]);
  await database.pool.query('DELETE FROM "tools"."ToolsOrganization" WHERE "id" = $1', [ids.organization]);
  await database.prisma.user.deleteMany({ where: { id: ids.user } });
}

integrationDescription("Research audit completeness and safety", () => {
  let database: PrismaContext;

  beforeAll(async () => {
    database = createPrismaContext({
      DATABASE_HOST: process.env.DATABASE_HOST,
      DATABASE_PORT: process.env.DATABASE_PORT,
      DATABASE_USER: process.env.DATABASE_USER,
      DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
      DATABASE_NAME: process.env.DATABASE_NAME,
      DATABASE_SSLMODE: process.env.DATABASE_SSLMODE,
    });
    await cleanup(database);
    await database.prisma.user.create({
      data: {
        id: ids.user,
        email: `${prefix}@example.invalid`,
        name: "Research audit safety user",
        systemRole: "ANALYST",
      },
    });
    await database.pool.query(
      `INSERT INTO "tools"."ToolsOrganization" ("id", "slug", "name") VALUES ($1, $2, 'Audit organization')`,
      [ids.organization, prefix],
    );
    await database.pool.query(
      `INSERT INTO "tools"."ToolsProject" ("id", "organizationId", "slug", "name") VALUES ($1, $2, $3, 'Audit project')`,
      [ids.project, ids.organization, prefix],
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
  });

  afterAll(async () => {
    await cleanup(database);
    await database.close();
  });

  it("records tenant scope, actor and correlation without raw sensitive input", async () => {
    const service = new ResearchService(
      new PrismaResearchRepository(ids.user, database.prisma),
      new AuthorizationService(new PrismaAccessGrantRepository(database.prisma)),
      { estimateRunCostKopecks: () => 100 },
      { dailyLimitKopecks: 50_000, monthlyLimitKopecks: 300_000 },
    );
    const principal: PlatformAnalystPrincipal = {
      kind: "platform-analyst",
      userId: ids.user,
      correlationId,
    };
    const sensitiveValues = [
      "private.person@example.invalid",
      "+70000000000",
      "provider-secret-value",
      "https://storage.invalid/object?signature=secret-signature",
      "sensitive search phrase",
    ];
    const research = await service.create(principal, {
      organizationId: ids.organization,
      projectId: ids.project,
      title: sensitiveValues[0]!,
      brief: `${sensitiveValues[1]} ${sensitiveValues[2]} ${sensitiveValues[3]}`,
      queries: [sensitiveValues[4]!],
    });
    const result = await database.pool.query<{ record: Record<string, unknown> }>(
      `SELECT to_jsonb(audit) AS record FROM "public"."AuditEvent" AS audit
       WHERE "correlationId"=$1 AND "action"='research.create'`,
      [correlationId],
    );
    const record = result.rows[0]?.record;
    expect(record).toBeDefined();
    const marker = record?.afterMarker as Record<string, unknown>;
    expect(record).toMatchObject({
      actorType: "USER",
      actorId: ids.user,
      action: "research.create",
      entityType: "Research",
      entityId: research.id,
      correlationId,
      source: "research",
    });
    expect(record?.organizationId ?? marker.toolsOrganizationId).toBe(ids.organization);
    expect(record?.projectId ?? marker.toolsProjectId).toBe(ids.project);
    expect(marker).toMatchObject({
      toolsOrganizationId: ids.organization,
      toolsProjectId: ids.project,
      queryCount: 1,
    });

    const serialized = JSON.stringify(record);
    for (const forbidden of sensitiveValues) expect(serialized).not.toContain(forbidden);
  });
});

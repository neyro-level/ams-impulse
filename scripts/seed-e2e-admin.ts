import { randomUUID } from "node:crypto";
import { hashPassword, symmetricEncrypt } from "better-auth/crypto";
import { createLocalAccountIssuer } from "better-auth/db";
import { Prisma } from "../src/generated/prisma/client.ts";
import {
  closePrismaClient,
  getPrismaClient,
} from "../src/platform/database/prisma/client.ts";
import { E2E_RESEARCH } from "./e2e-research-contract.ts";
import { E2E_PLATFORM_ADMIN_TOTP_SECRET } from "./e2e-auth-contract.ts";

const E2E_PASSWORD = "E2e!2026";
const CLIENT_USERNAMES = [
  "e2e.client.mobile",
  "e2e.client.tablet",
  "e2e.client.desktop1280",
  "e2e.client.desktop1440",
] as const;
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);

async function main() {
  if (process.argv[2] !== "--confirm-local-e2e") {
    throw new Error("Explicit local E2E confirmation is required");
  }
  if (!process.env.DATABASE_HOST || !localHosts.has(process.env.DATABASE_HOST)) {
    throw new Error("E2E identity seed is restricted to a loopback PostgreSQL host");
  }

  const prisma = getPrismaClient();
  try {
    const issuer = createLocalAccountIssuer("credential");
    const passwordHash = await hashPassword(E2E_PASSWORD);
    const provisionUser = async (input: {
      username: string;
      email: string;
      name: string;
      systemRole: "PLATFORM_ADMIN" | "ANALYST" | "CLIENT";
    }) => {
      const existing = await prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      const userId = existing?.id ?? randomUUID();
      await prisma.user.upsert({
        where: { email: input.email },
        update: {
          name: input.name,
          username: input.username,
          systemRole: input.systemRole,
          twoFactorEnabled: input.systemRole === "PLATFORM_ADMIN",
          disabledAt: null,
        },
        create: {
          id: userId,
          email: input.email,
          username: input.username,
          name: input.name,
          systemRole: input.systemRole,
          twoFactorEnabled: input.systemRole === "PLATFORM_ADMIN",
          emailVerified: false,
        },
      });
      await prisma.account.upsert({
        where: { issuer_accountId: { issuer, accountId: userId } },
        update: { userId, providerId: "credential", password: passwordHash },
        create: {
          id: randomUUID(),
          userId,
          providerId: "credential",
          issuer,
          accountId: userId,
          password: passwordHash,
        },
      });
      return userId;
    };

    const platformAdminUserId = await provisionUser({
      username: "e2e.platform.admin",
      email: "e2e-platform-admin@example.invalid",
      name: "E2E Platform Admin",
      systemRole: "PLATFORM_ADMIN",
    });
    const authSecret = process.env.BETTER_AUTH_SECRET?.trim();
    if (!authSecret) throw new Error("BETTER_AUTH_SECRET is required for the E2E Platform Admin TOTP");
    const encryptedTotpSecret = await symmetricEncrypt({ key: authSecret, data: E2E_PLATFORM_ADMIN_TOTP_SECRET });
    const disabledBackupCodes = await symmetricEncrypt({ key: authSecret, data: "[]" });
    await prisma.twoFactor.upsert({
      where: { userId: platformAdminUserId },
      update: {
        secret: encryptedTotpSecret,
        backupCodes: disabledBackupCodes,
        verified: true,
        failedVerificationCount: 0,
        lockedUntil: null,
      },
      create: {
        id: randomUUID(),
        userId: platformAdminUserId,
        secret: encryptedTotpSecret,
        backupCodes: disabledBackupCodes,
        verified: true,
      },
    });

    const analystUserId = await provisionUser({
      username: E2E_RESEARCH.analystUsername,
      email: "e2e-research-analyst@example.invalid",
      name: "E2E Research Analyst",
      systemRole: "ANALYST",
    });
    if (analystUserId !== E2E_RESEARCH.analystUserId) {
      await prisma.account.deleteMany({ where: { userId: analystUserId } });
      await prisma.user.delete({ where: { id: analystUserId } });
      await prisma.user.create({
        data: {
          id: E2E_RESEARCH.analystUserId,
          username: E2E_RESEARCH.analystUsername,
          email: "e2e-research-analyst@example.invalid",
          name: "E2E Research Analyst",
          systemRole: "ANALYST",
        },
      });
      await prisma.account.create({
        data: {
          id: randomUUID(),
          userId: E2E_RESEARCH.analystUserId,
          providerId: "credential",
          issuer,
          accountId: E2E_RESEARCH.analystUserId,
          password: passwordHash,
        },
      });
    }

    for (const [organizationId, slug, name] of [
      [E2E_RESEARCH.allowedOrganizationId, "e2e-tools-allowed", "E2E Tools Allowed"],
      [E2E_RESEARCH.deniedOrganizationId, "e2e-tools-denied", "E2E Tools Denied"],
      [E2E_RESEARCH.budgetOrganizationId, "e2e-tools-budget", "E2E Tools Budget"],
    ] as const) {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "tools"."ToolsOrganization" ("id", "slug", "name")
        VALUES (${organizationId}, ${slug}, ${name})
        ON CONFLICT ("id") DO UPDATE SET "slug"=EXCLUDED."slug", "name"=EXCLUDED."name"
      `);
    }
    for (const [projectId, organizationId, slug, name] of [
      [E2E_RESEARCH.allowedProjectId, E2E_RESEARCH.allowedOrganizationId, "allowed", "Research Allowed"],
      [E2E_RESEARCH.deniedProjectId, E2E_RESEARCH.deniedOrganizationId, "denied", "Research Denied"],
      [E2E_RESEARCH.budgetProjectId, E2E_RESEARCH.budgetOrganizationId, "budget", "Research Budget"],
    ] as const) {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "tools"."ToolsProject" ("id", "organizationId", "slug", "name")
        VALUES (${projectId}, ${organizationId}, ${slug}, ${name})
        ON CONFLICT ("id") DO UPDATE SET "name"=EXCLUDED."name", "archivedAt"=NULL
      `);
    }
    for (const [organizationId, projectId, suffix] of [
      [E2E_RESEARCH.allowedOrganizationId, E2E_RESEARCH.allowedProjectId, "allowed"],
      [E2E_RESEARCH.budgetOrganizationId, E2E_RESEARCH.budgetProjectId, "budget"],
    ] as const) {
      const membershipId = `e2e-tools-membership-${suffix}`;
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "tools"."ToolsMembership" ("id", "organizationId", "userId")
        VALUES (${membershipId}, ${organizationId}, ${E2E_RESEARCH.analystUserId})
        ON CONFLICT ("organizationId", "userId") DO NOTHING
      `);
      const memberships = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "tools"."ToolsMembership"
        WHERE "organizationId"=${organizationId} AND "userId"=${E2E_RESEARCH.analystUserId}
      `);
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "tools"."ToolsProjectAccess"
          ("id", "membershipId", "organizationId", "projectId", "role")
        VALUES (${`e2e-tools-access-${suffix}`}, ${memberships[0]!.id}, ${organizationId}, ${projectId}, 'ANALYST')
        ON CONFLICT ("membershipId", "projectId") DO UPDATE SET "role"='ANALYST'
      `);
    }
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "research"."Research"
        ("id", "organizationId", "projectId", "title", "brief", "status", "createdByUserId")
      VALUES
        (${E2E_RESEARCH.deniedResearchId}, ${E2E_RESEARCH.deniedOrganizationId}, ${E2E_RESEARCH.deniedProjectId}, 'Foreign research', '', 'DRAFT', ${E2E_RESEARCH.analystUserId}),
        (${E2E_RESEARCH.staleResearchId}, ${E2E_RESEARCH.allowedOrganizationId}, ${E2E_RESEARCH.allowedProjectId}, 'Stale research', '', 'DRAFT', ${E2E_RESEARCH.analystUserId}),
        (${E2E_RESEARCH.budgetResearchId}, ${E2E_RESEARCH.budgetOrganizationId}, ${E2E_RESEARCH.budgetProjectId}, 'Budget research', '', 'DRAFT', ${E2E_RESEARCH.analystUserId})
      ON CONFLICT ("id") DO UPDATE SET "status"='DRAFT', "version"=1, "archivedAt"=NULL
    `);
    for (const [queryId, organizationId, projectId, researchId] of [
      ["e2e-query-stale", E2E_RESEARCH.allowedOrganizationId, E2E_RESEARCH.allowedProjectId, E2E_RESEARCH.staleResearchId],
      ["e2e-query-budget", E2E_RESEARCH.budgetOrganizationId, E2E_RESEARCH.budgetProjectId, E2E_RESEARCH.budgetResearchId],
    ] as const) {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "research"."Query"
          ("id", "organizationId", "projectId", "researchId", "text", "position")
        VALUES (${queryId}, ${organizationId}, ${projectId}, ${researchId}, 'synthetic query', 0)
        ON CONFLICT ("researchId", "position") DO UPDATE SET "text"='synthetic query'
      `);
    }
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "research"."Run"
        ("id", "organizationId", "projectId", "researchId", "status", "queryCount",
         "estimatedCostKopecks", "estimateExpiresAt", "approvedCostKopecks", "actualCostKopecks",
         "idempotencyKey", "confirmedByUserId", "confirmedAt", "finishedAt")
      VALUES ('e2e-budget-run', ${E2E_RESEARCH.budgetOrganizationId}, ${E2E_RESEARCH.budgetProjectId},
        ${E2E_RESEARCH.budgetResearchId}, 'SUCCEEDED', 1, 50000, CURRENT_TIMESTAMP + INTERVAL '1 hour',
        50000, 50000, 'e2e-budget-limit', ${E2E_RESEARCH.analystUserId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO UPDATE SET "status"='SUCCEEDED', "approvedCostKopecks"=50000,
        "actualCostKopecks"=50000, "confirmedAt"=CURRENT_TIMESTAMP, "finishedAt"=CURRENT_TIMESTAMP
    `);

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { slug: "alpha" },
      select: { id: true },
    });
    for (const username of CLIENT_USERNAMES) {
      const userId = await provisionUser({
        username,
        email: `${username}@example.invalid`,
        name: `E2E ${username}`,
        systemRole: "CLIENT",
      });
      await prisma.member.upsert({
        where: {
          organizationId_userId: { organizationId: organization.id, userId },
        },
        update: { tenantRole: "VIEWER" },
        create: {
          organizationId: organization.id,
          userId,
          tenantRole: "VIEWER",
        },
      });
    }
    console.log(JSON.stringify({ seeded: true, identityCount: 2 + CLIENT_USERNAMES.length }));
  } finally {
    await closePrismaClient();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "E2E identity seed failed");
  process.exitCode = 1;
});

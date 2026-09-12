import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaContext } from "../src/platform/database/prisma/context.ts";
import { getPrincipalStateByUserId } from "../src/platform/authorization/principal-factories.ts";

const integrationEnabled = Boolean(
  process.env.DATABASE_HOST &&
    process.env.DATABASE_USER &&
    process.env.DATABASE_PASSWORD &&
    process.env.DATABASE_NAME,
);
const integrationDescription = integrationEnabled ? describe : describe.skip;
const suffix = "principal-factory-integration";
const correlationId = "00000000-0000-4000-8000-000000000071";

integrationDescription("PrincipalContext factories", () => {
  let database: ReturnType<typeof createPrismaContext>;
  let organizationId = "";

  beforeAll(async () => {
    database = createPrismaContext({
      DATABASE_HOST: process.env.DATABASE_HOST,
      DATABASE_PORT: process.env.DATABASE_PORT,
      DATABASE_USER: process.env.DATABASE_USER,
      DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
      DATABASE_NAME: process.env.DATABASE_NAME,
      DATABASE_SSLMODE: process.env.DATABASE_SSLMODE,
    });
    await database.prisma.member.deleteMany({
      where: { user: { email: { endsWith: `.${suffix}@example.invalid` } } },
    });
    await database.prisma.user.deleteMany({
      where: { email: { endsWith: `.${suffix}@example.invalid` } },
    });
    await database.prisma.organization.deleteMany({ where: { slug: { startsWith: suffix } } });

    const organization = await database.prisma.organization.create({
      data: { slug: `${suffix}-a`, name: "Principal integration organization" },
    });
    organizationId = organization.id;
    await database.prisma.user.createMany({
      data: [
        {
          id: `${suffix}-admin`,
          email: `admin.${suffix}@example.invalid`,
          name: "Admin",
          systemRole: "PLATFORM_ADMIN",
          twoFactorEnabled: true,
        },
        {
          id: `${suffix}-analyst`,
          email: `analyst.${suffix}@example.invalid`,
          name: "Analyst",
          systemRole: "ANALYST",
        },
        {
          id: `${suffix}-viewer`,
          email: `viewer.${suffix}@example.invalid`,
          name: "Viewer",
          systemRole: "CLIENT",
        },
        {
          id: `${suffix}-nomember`,
          email: `nomember.${suffix}@example.invalid`,
          name: "No member",
          systemRole: "CLIENT",
        },
      ],
    });
    await database.prisma.member.create({
      data: {
        organizationId,
        userId: `${suffix}-viewer`,
        tenantRole: "VIEWER",
      },
    });
  });

  afterAll(async () => {
    await database.prisma.member.deleteMany({
      where: { user: { email: { endsWith: `.${suffix}@example.invalid` } } },
    });
    await database.prisma.user.deleteMany({
      where: { email: { endsWith: `.${suffix}@example.invalid` } },
    });
    await database.prisma.organization.deleteMany({ where: { id: organizationId } });
    await database.close();
  });

  it("builds platform and neutral identity principals without fake organization scope", async () => {
    await expect(
      getPrincipalStateByUserId(`${suffix}-admin`, { correlationId }),
    ).resolves.toMatchObject({
      principal: { kind: "platform-admin", userId: `${suffix}-admin`, correlationId },
    });
    await expect(
      getPrincipalStateByUserId(`${suffix}-analyst`, { correlationId }),
    ).resolves.toMatchObject({
      principal: {
        kind: "identity-user",
        userId: `${suffix}-analyst`,
        systemRole: "ANALYST",
        correlationId,
      },
    });
    await expect(
      getPrincipalStateByUserId(`${suffix}-viewer`, {
        correlationId,
      }),
    ).resolves.toMatchObject({
      principal: {
        kind: "identity-user",
        userId: `${suffix}-viewer`,
        systemRole: "CLIENT",
        correlationId,
      },
    });
    await expect(
      getPrincipalStateByUserId(`${suffix}-nomember`, { correlationId }),
    ).resolves.toMatchObject({
      principal: {
        kind: "identity-user",
        userId: `${suffix}-nomember`,
        systemRole: "CLIENT",
        correlationId,
      },
    });
  });

  it("denies platform admin authority until TOTP enrollment is verified", async () => {
    await database.prisma.user.update({
      where: { id: `${suffix}-admin` },
      data: { twoFactorEnabled: false },
    });
    await expect(
      getPrincipalStateByUserId(`${suffix}-admin`, { correlationId }),
    ).resolves.toBeNull();
    await database.prisma.user.update({
      where: { id: `${suffix}-admin` },
      data: { twoFactorEnabled: true },
    });
  });
});

import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { PrismaPg } from "@prisma/adapter-pg";
import { createLocalAccountIssuer } from "better-auth/db";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, SystemRole } from "../src/generated/prisma/client.ts";
import { createPgPoolConfigFromEnvironment } from "../src/platform/database/prisma/pool-config.ts";

const integrationEnabled = Boolean(
  process.env.TEST_DATABASE_HOST &&
    process.env.TEST_DATABASE_USER &&
    process.env.TEST_DATABASE_PASSWORD &&
    process.env.TEST_DATABASE_NAME,
);
const integrationDescription = integrationEnabled ? describe : describe.skip;

integrationDescription("legacy Platform Admin adoption", () => {
  let prisma: PrismaClient;
  let pool: Pool;

  beforeAll(() => {
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  it("rotates credentials and grants authority only after verified TOTP", async () => {
    const username = `legacy_admin_${randomUUID().slice(0, 8)}`;
    const email = `${username}@example.invalid`;
    const userId = randomUUID();
    const previousAdmins = await prisma.user.findMany({
      where: { systemRole: SystemRole.PLATFORM_ADMIN },
      select: { id: true },
    });
    const materialDirectory = await mkdtemp(path.join(tmpdir(), "ams-admin-adoption-"));
    const materialPath = path.join(materialDirectory, "recovery.json");
    const newPassword = "new-owner-password-2026";

    try {
      await prisma.user.updateMany({
        where: { id: { in: previousAdmins.map(({ id }) => id) } },
        data: { systemRole: SystemRole.CLIENT },
      });
      await prisma.user.create({
        data: {
          id: userId,
          username,
          email,
          name: "Legacy Platform Admin",
          systemRole: SystemRole.PLATFORM_ADMIN,
          twoFactorEnabled: false,
          accounts: {
            create: {
              id: randomUUID(),
              providerId: "credential",
              issuer: createLocalAccountIssuer("credential"),
              accountId: userId,
              password: await hashPassword("old-owner-password-2025"),
            },
          },
          sessions: {
            create: {
              id: randomUUID(),
              token: randomUUID(),
              expiresAt: new Date(Date.now() + 60_000),
            },
          },
        },
      });

      const adoption = spawnSync(
        process.execPath,
        [
          "node_modules/tsx/dist/cli.mjs",
          "scripts/auth-admin.ts",
          "adopt-legacy-platform-admin",
          "--username",
          username,
          "--material-output",
          materialPath,
        ],
        { cwd: process.cwd(), env: process.env, encoding: "utf8", input: newPassword },
      );
      expect(adoption.stderr).toBe("");
      expect(adoption.status).toBe(0);

      const pendingUser = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        include: { twoFactor: true, accounts: true, sessions: true, adminRecoveryCodes: true },
      });
      expect(pendingUser.systemRole).toBe(SystemRole.PLATFORM_ADMIN);
      expect(pendingUser.twoFactorEnabled).toBe(false);
      expect(pendingUser.twoFactor?.verified).toBe(false);
      expect(pendingUser.sessions).toHaveLength(0);
      expect(pendingUser.adminRecoveryCodes.length).toBeGreaterThan(0);
      expect(
        await verifyPassword({
          hash: pendingUser.accounts[0]?.password ?? "",
          password: newPassword,
        }),
      ).toBe(true);

      const material = JSON.parse(await readFile(materialPath, "utf8")) as {
        totpUri: string;
        recoveryCodes: string[];
      };
      expect(material.recoveryCodes.length).toBeGreaterThan(0);
      const encodedSecret = new URL(material.totpUri).searchParams.get("secret");
      expect(encodedSecret).toBeTruthy();
      const secret = new TextDecoder().decode(base32.decode(encodedSecret!));
      const code = await createOTP(secret, { digits: 6, period: 30 }).totp();
      const verification = spawnSync(
        process.execPath,
        [
          "node_modules/tsx/dist/cli.mjs",
          "scripts/auth-admin.ts",
          "verify-platform-admin-adoption",
          "--username",
          username,
        ],
        { cwd: process.cwd(), env: process.env, encoding: "utf8", input: code },
      );
      expect(verification.stderr).toBe("");
      expect(verification.status).toBe(0);

      const verifiedUser = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        include: { twoFactor: true },
      });
      expect(verifiedUser.twoFactorEnabled).toBe(true);
      expect(verifiedUser.twoFactor?.verified).toBe(true);
      await expect(
        prisma.auditEvent.count({
          where: {
            entityId: userId,
            action: {
              in: [
                "platform-admin.legacy-adoption.started",
                "platform-admin.legacy-adoption.completed",
              ],
            },
          },
        }),
      ).resolves.toBe(2);
    } finally {
      await prisma.auditEvent.deleteMany({ where: { entityId: userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.user.updateMany({
        where: { id: { in: previousAdmins.map(({ id }) => id) } },
        data: { systemRole: SystemRole.PLATFORM_ADMIN },
      });
      await rm(materialDirectory, { recursive: true, force: true });
    }
  }, 60_000);
});

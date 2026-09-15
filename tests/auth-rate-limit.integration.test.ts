import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { createAuthRateLimitConfig } from "../src/platform/auth/security-config.ts";

const testIp = "203.0.113.71";
const rateLimitKey = `${testIp}|/sign-in/username`;

let pool: Pool;
let prisma: PrismaClient;

function createTestAuth() {
  return betterAuth({
    secret: "integration-test-secret-at-least-32-characters",
    baseURL: "http://127.0.0.1:3000",
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
    },
    rateLimit: createAuthRateLimitConfig(),
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["x-real-ip"],
      },
    },
    plugins: [username()],
  });
}

async function attemptUsernameSignIn(auth: ReturnType<typeof createTestAuth>) {
  return auth.handler(new Request("http://127.0.0.1:3000/api/auth/sign-in/username", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": testIp,
    },
    body: JSON.stringify({
      username: "missing-rate-limit-user",
      password: "incorrect-password",
    }),
  }));
}

describe("Better Auth database rate limiting", () => {
  beforeAll(async () => {
    if (process.env.TEST_RUNTIME_DATABASE_USER !== "ams_web") {
      throw new Error("Rate-limit proof requires the real ams_web role");
    }
    pool = new Pool({
      host: process.env.TEST_DATABASE_HOST,
      port: Number(process.env.TEST_DATABASE_PORT ?? "5432"),
      user: process.env.TEST_RUNTIME_DATABASE_USER,
      password: process.env.TEST_RUNTIME_DATABASE_PASSWORD,
      database: process.env.TEST_DATABASE_NAME,
      ssl: process.env.TEST_DATABASE_SSLMODE === "require" ? { rejectUnauthorized: true } : false,
      max: 2,
    });
    await expect(pool.query<{ current_user: string }>("SELECT current_user")).resolves.toMatchObject({
      rows: [{ current_user: "ams_web" }],
    });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    await prisma.rateLimit.deleteMany({ where: { key: rateLimitKey } });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.rateLimit.deleteMany({ where: { key: rateLimitKey } });
      await prisma.$disconnect();
    }
    if (pool) await pool.end();
  });

  it("rejects the sixth sign-in attempt and shares the counter between auth instances", async () => {
    const firstInstance = createTestAuth();
    const secondInstance = createTestAuth();

    const firstResponses = await Promise.all([
      attemptUsernameSignIn(firstInstance),
      attemptUsernameSignIn(firstInstance),
      attemptUsernameSignIn(firstInstance),
    ]);
    expect(firstResponses.every((response) => response.status !== 429)).toBe(true);

    const fourth = await attemptUsernameSignIn(secondInstance);
    const fifth = await attemptUsernameSignIn(secondInstance);
    const sixth = await attemptUsernameSignIn(secondInstance);

    expect(fourth.status).not.toBe(429);
    expect(fifth.status).not.toBe(429);
    expect(sixth.status).toBe(429);
    await expect(prisma.rateLimit.findUniqueOrThrow({ where: { key: rateLimitKey } }))
      .resolves.toMatchObject({ count: 5 });
  });
});

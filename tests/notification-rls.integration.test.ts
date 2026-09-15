import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaContext, type PrismaContext } from "../src/platform/database/prisma/context.ts";

const enabled = Boolean(
  process.env.TEST_DATABASE_HOST
    && process.env.TEST_DATABASE_USER
    && process.env.TEST_DATABASE_PASSWORD
    && process.env.TEST_DATABASE_NAME
    && process.env.TEST_RUNTIME_DATABASE_USER
    && process.env.TEST_RUNTIME_DATABASE_PASSWORD,
);
const integrationDescription = enabled ? describe : describe.skip;
const prefix = "notification-rls-proof";
const ids = {
  analyst: `${prefix}-analyst`,
  admin: `${prefix}-admin`,
  outsider: `${prefix}-outsider`,
  organizationA: `${prefix}-org-a`,
  organizationB: `${prefix}-org-b`,
  projectA: `${prefix}-project-a`,
  projectB: `${prefix}-project-b`,
  membership: `${prefix}-membership`,
  access: `${prefix}-access`,
  notificationOrgA: `${prefix}-org-a-visible`,
  notificationProjectA: `${prefix}-project-a-visible`,
  notificationProjectB: `${prefix}-project-b-hidden`,
  notificationOrgB: `${prefix}-org-b-hidden`,
  notificationGlobal: `${prefix}-global-admin`,
  notificationOrgAdmin: `${prefix}-org-admin`,
} as const;

async function inRuntimeTransaction<T>(
  runtime: Pool,
  userId: string,
  operation: (client: PoolClient) => Promise<T>,
) {
  const client = await runtime.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('ams.user_id', $1, true)", [userId]);
    const result = await operation(client);
    await client.query("ROLLBACK");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

integrationDescription("Notification RLS scope matrix", () => {
  let owner: PrismaContext;
  let runtime: Pool;

  beforeAll(async () => {
    owner = createPrismaContext({
      DATABASE_HOST: process.env.TEST_DATABASE_HOST,
      DATABASE_PORT: process.env.TEST_DATABASE_PORT,
      DATABASE_USER: process.env.TEST_DATABASE_USER,
      DATABASE_PASSWORD: process.env.TEST_DATABASE_PASSWORD,
      DATABASE_NAME: process.env.TEST_DATABASE_NAME,
      DATABASE_SSLMODE: process.env.TEST_DATABASE_SSLMODE,
    });
    await owner.pool.query('DELETE FROM "Notification" WHERE "id" LIKE $1', [`${prefix}%`]);
    await owner.pool.query('DELETE FROM "SeoProjectAccess" WHERE "id" LIKE $1', [`${prefix}%`]);
    await owner.pool.query('DELETE FROM "Member" WHERE "id" LIKE $1', [`${prefix}%`]);
    await owner.pool.query('DELETE FROM "Project" WHERE "id" LIKE $1', [`${prefix}%`]);
    await owner.pool.query('DELETE FROM "Organization" WHERE "id" LIKE $1', [`${prefix}%`]);
    await owner.pool.query('DELETE FROM "User" WHERE "id" LIKE $1', [`${prefix}%`]);

    const reference = await owner.pool.query<{
      thresholdProfileId: string;
      clusterProfileId: string;
    }>('SELECT "thresholdProfileId", "clusterProfileId" FROM "Project" LIMIT 1');
    const profile = reference.rows[0];
    if (!profile) throw new Error("Seeded project profiles are required for Notification RLS proof");

    await owner.pool.query(
      `INSERT INTO "User" ("id", "name", "email", "systemRole", "createdAt", "updatedAt") VALUES
        ($1, 'Analyst', $2, 'SEO_ANALYST', now(), now()),
        ($3, 'Admin', $4, 'PLATFORM_ADMIN', now(), now()),
        ($5, 'Outsider', $6, 'SEO_ANALYST', now(), now())`,
      [ids.analyst, `${ids.analyst}@example.invalid`, ids.admin, `${ids.admin}@example.invalid`, ids.outsider, `${ids.outsider}@example.invalid`],
    );
    await owner.pool.query(
      `INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt") VALUES
        ($1, 'Organization A', $2, now(), now()), ($3, 'Organization B', $4, now(), now())`,
      [ids.organizationA, ids.organizationA, ids.organizationB, ids.organizationB],
    );
    await owner.pool.query(
      `INSERT INTO "Project"
        ("id", "organizationId", "slug", "name", "status", "thresholdProfileId", "clusterProfileId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'Project A', 'ACTIVE', $4, $5, now(), now()),
              ($6, $2, $7, 'Project B', 'ACTIVE', $4, $5, now(), now())`,
      [ids.projectA, ids.organizationA, ids.projectA, profile.thresholdProfileId, profile.clusterProfileId, ids.projectB, ids.projectB],
    );
    await owner.pool.query(
      `INSERT INTO "Member" ("id", "userId", "organizationId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, now(), now())`,
      [ids.membership, ids.analyst, ids.organizationA],
    );
    await owner.pool.query(
      `INSERT INTO "SeoProjectAccess"
        ("id", "membershipId", "organizationId", "projectId", "role", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'ANALYST', now(), now())`,
      [ids.access, ids.membership, ids.organizationA, ids.projectA],
    );

    const rows = [
      [ids.notificationOrgA, ids.organizationA, null, "PLATFORM_TEAM"],
      [ids.notificationProjectA, ids.organizationA, ids.projectA, "PLATFORM_TEAM"],
      [ids.notificationProjectB, ids.organizationA, ids.projectB, "PLATFORM_TEAM"],
      [ids.notificationOrgB, ids.organizationB, null, "PLATFORM_TEAM"],
      [ids.notificationGlobal, null, null, "PLATFORM_ADMIN_ONLY"],
      [ids.notificationOrgAdmin, ids.organizationA, null, "PLATFORM_ADMIN_ONLY"],
    ] as const;
    for (const [id, organizationId, projectId, visibility] of rows) {
      await owner.pool.query(
        `INSERT INTO "Notification"
          ("id", "organizationId", "projectId", "category", "severity", "visibility", "title", "message", "sourceType", "dedupKey", "occurredAt")
         VALUES ($1, $2, $3, 'ACCESS', 'INFO', $4, $1, 'safe', 'RlsProof', $1, now())`,
        [id, organizationId, projectId, visibility],
      );
    }

    if (process.env.TEST_RUNTIME_DATABASE_USER !== "ams_web") {
      throw new Error("Notification RLS proof requires the real ams_web role");
    }
    await owner.pool.query(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Notification", "NotificationRead" TO ams_web',
    );
    runtime = new Pool({
      host: process.env.TEST_DATABASE_HOST,
      port: Number(process.env.TEST_DATABASE_PORT ?? "5432"),
      user: process.env.TEST_RUNTIME_DATABASE_USER,
      password: process.env.TEST_RUNTIME_DATABASE_PASSWORD,
      database: process.env.TEST_DATABASE_NAME,
      ssl: process.env.TEST_DATABASE_SSLMODE === "require" ? { rejectUnauthorized: true } : false,
      max: 2,
    });
  });

  afterAll(async () => {
    if (runtime) await runtime.end();
    if (owner) {
      await owner.pool.query('DELETE FROM "Notification" WHERE "id" LIKE $1', [`${prefix}%`]);
      await owner.pool.query('DELETE FROM "SeoProjectAccess" WHERE "id" LIKE $1', [`${prefix}%`]);
      await owner.pool.query('DELETE FROM "Member" WHERE "id" LIKE $1', [`${prefix}%`]);
      await owner.pool.query('DELETE FROM "Project" WHERE "id" LIKE $1', [`${prefix}%`]);
      await owner.pool.query('DELETE FROM "Organization" WHERE "id" LIKE $1', [`${prefix}%`]);
      await owner.pool.query('DELETE FROM "User" WHERE "id" LIKE $1', [`${prefix}%`]);
      await owner.close();
    }
  });

  it("shows organization and granted-project rows but hides other scopes", async () => {
    const visible = await inRuntimeTransaction(runtime, ids.analyst, async (client) => {
      const result = await client.query<{ id: string }>(
        'SELECT "id" FROM "Notification" WHERE "id" LIKE $1 ORDER BY "id"',
        [`${prefix}%`],
      );
      return result.rows.map((row) => row.id);
    });
    expect(visible).toEqual([ids.notificationOrgA, ids.notificationProjectA].sort());
  });

  it("shows no tenant rows to a user without membership or grants", async () => {
    const count = await inRuntimeTransaction(runtime, ids.outsider, async (client) => {
      const result = await client.query<{ count: string }>(
        'SELECT count(*) AS count FROM "Notification" WHERE "id" LIKE $1',
        [`${prefix}%`],
      );
      return Number(result.rows[0]?.count ?? 0);
    });
    expect(count).toBe(0);
  });

  it("allows Platform Admin to see project, organization and global rows", async () => {
    const count = await inRuntimeTransaction(runtime, ids.admin, async (client) => {
      const result = await client.query<{ count: string }>(
        'SELECT count(*) AS count FROM "Notification" WHERE "id" LIKE $1',
        [`${prefix}%`],
      );
      return Number(result.rows[0]?.count ?? 0);
    });
    expect(count).toBe(6);
  });

  it("allows only the current user to create a read marker for a visible notification", async () => {
    await expect(inRuntimeTransaction(runtime, ids.analyst, async (client) => {
      await client.query(
        'INSERT INTO "NotificationRead" ("notificationId", "userId", "readAt") VALUES ($1, $2, now())',
        [ids.notificationOrgA, ids.analyst],
      );
      const result = await client.query<{ count: string }>(
        'SELECT count(*) AS count FROM "NotificationRead" WHERE "notificationId" = $1',
        [ids.notificationOrgA],
      );
      return Number(result.rows[0]?.count ?? 0);
    })).resolves.toBe(1);

    await expect(inRuntimeTransaction(runtime, ids.analyst, async (client) => {
      await client.query(
        'INSERT INTO "NotificationRead" ("notificationId", "userId", "readAt") VALUES ($1, $2, now())',
        [ids.notificationOrgA, ids.outsider],
      );
    })).rejects.toThrow();
  });
});

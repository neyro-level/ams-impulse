import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaContext, type PrismaContext } from "../src/platform/database/prisma/context.ts";

const integrationEnabled = Boolean(
  process.env.TEST_DATABASE_HOST
    && process.env.TEST_DATABASE_USER
    && process.env.TEST_DATABASE_PASSWORD
    && process.env.TEST_DATABASE_NAME
    && process.env.TEST_RUNTIME_DATABASE_USER
    && process.env.TEST_RUNTIME_DATABASE_PASSWORD,
);
const integrationDescription = integrationEnabled ? describe : describe.skip;
const prefix = "research-rls-proof";
const ids = {
  user: `${prefix}-user`,
  organizationA: `${prefix}-org-a`,
  organizationB: `${prefix}-org-b`,
  projectA: `${prefix}-project-a`,
  projectB: `${prefix}-project-b`,
  projectC: `${prefix}-project-c`,
  membership: `${prefix}-membership`,
  access: `${prefix}-access`,
  researchA: `${prefix}-research-a`,
  researchB: `${prefix}-research-b`,
  researchC: `${prefix}-research-c`,
} as const;

async function removeFixture(database: PrismaContext) {
  await database.pool.query('DELETE FROM "research"."Research" WHERE "id" LIKE $1', [`${prefix}%`]);
  await database.pool.query('DELETE FROM "tools"."ToolsProjectAccess" WHERE "id" LIKE $1', [`${prefix}%`]);
  await database.pool.query('DELETE FROM "tools"."ToolsMembership" WHERE "id" LIKE $1', [`${prefix}%`]);
  await database.pool.query('DELETE FROM "tools"."ToolsProject" WHERE "id" LIKE $1', [`${prefix}%`]);
  await database.pool.query('DELETE FROM "tools"."ToolsOrganization" WHERE "id" LIKE $1', [`${prefix}%`]);
  await database.prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
}

async function inRuntimeTransaction<T>(
  pool: Pool,
  userId: string | null,
  operation: (client: PoolClient) => Promise<T>,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (userId) await client.query("SELECT set_config('ams.user_id', $1, true)", [userId]);
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

integrationDescription("Research RLS matrix", () => {
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
    await removeFixture(owner);
    await owner.prisma.user.create({
      data: {
        id: ids.user,
        email: `${prefix}@example.invalid`,
        name: "Research RLS analyst",
        systemRole: "ANALYST",
      },
    });
    await owner.pool.query(
      `INSERT INTO "tools"."ToolsOrganization" ("id", "slug", "name") VALUES
        ($1, $2, 'Organization A'), ($3, $4, 'Organization B')`,
      [ids.organizationA, `${prefix}-a`, ids.organizationB, `${prefix}-b`],
    );
    await owner.pool.query(
      `INSERT INTO "tools"."ToolsProject" ("id", "organizationId", "slug", "name") VALUES
        ($1, $2, 'a', 'Project A'), ($3, $2, 'b', 'Project B'), ($4, $5, 'c', 'Project C')`,
      [ids.projectA, ids.organizationA, ids.projectB, ids.projectC, ids.organizationB],
    );
    await owner.pool.query(
      `INSERT INTO "tools"."ToolsMembership" ("id", "organizationId", "userId") VALUES ($1, $2, $3)`,
      [ids.membership, ids.organizationA, ids.user],
    );
    await owner.pool.query(
      `INSERT INTO "tools"."ToolsProjectAccess" ("id", "membershipId", "organizationId", "projectId", "role")
       VALUES ($1, $2, $3, $4, 'ANALYST')`,
      [ids.access, ids.membership, ids.organizationA, ids.projectA],
    );
    for (const [researchId, organizationId, projectId] of [
      [ids.researchA, ids.organizationA, ids.projectA],
      [ids.researchB, ids.organizationA, ids.projectB],
      [ids.researchC, ids.organizationB, ids.projectC],
    ] as const) {
      await owner.pool.query(
        `INSERT INTO "research"."Research"
          ("id", "organizationId", "projectId", "title", "brief", "createdByUserId")
         VALUES ($1, $2, $3, $4, '', $5)`,
        [researchId, organizationId, projectId, researchId, ids.user],
      );
    }

    const runtimeRole = process.env.TEST_RUNTIME_DATABASE_USER!;
    if (runtimeRole !== "ams_web") throw new Error("RLS proof requires the real ams_web role");
    await owner.pool.query(`GRANT USAGE ON SCHEMA "platform", "tools", "research" TO ams_web`);
    await owner.pool.query(`GRANT SELECT ON ALL TABLES IN SCHEMA "tools" TO ams_web`);
    await owner.pool.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "research" TO ams_web`,
    );
    runtime = new Pool({
      host: process.env.TEST_DATABASE_HOST,
      port: Number(process.env.TEST_DATABASE_PORT ?? "5432"),
      user: runtimeRole,
      password: process.env.TEST_RUNTIME_DATABASE_PASSWORD,
      database: process.env.TEST_DATABASE_NAME,
      ssl: process.env.TEST_DATABASE_SSLMODE === "require" ? { rejectUnauthorized: true } : false,
      max: 2,
    });
    await expect(runtime.query<{ current_user: string }>("SELECT current_user")).resolves.toMatchObject({
      rows: [{ current_user: "ams_web" }],
    });
  });

  afterAll(async () => {
    await runtime?.end();
    if (owner) {
      await removeFixture(owner);
      await owner.close();
    }
  });

  it("denies all Research rows when the database context is missing", async () => {
    const result = await inRuntimeTransaction(runtime, null, (client) =>
      client.query<{ id: string }>('SELECT "id" FROM "research"."Research" WHERE "id" LIKE $1', [`${prefix}%`]),
    );
    expect(result.rows).toEqual([]);
  });

  it("allows only the exact granted organization and project context", async () => {
    const result = await inRuntimeTransaction(runtime, ids.user, (client) =>
      client.query<{ id: string }>('SELECT "id" FROM "research"."Research" WHERE "id" LIKE $1 ORDER BY "id"', [`${prefix}%`]),
    );
    expect(result.rows).toEqual([{ id: ids.researchA }]);
  });

  it("denies sibling-project and cross-organization reads", async () => {
    const result = await inRuntimeTransaction(runtime, ids.user, (client) =>
      client.query<{ id: string }>(
        'SELECT "id" FROM "research"."Research" WHERE "id" = ANY($1::text[])',
        [[ids.researchB, ids.researchC]],
      ),
    );
    expect(result.rows).toEqual([]);
  });

  it("rejects cross-tenant inserts and filters cross-tenant updates", async () => {
    await expect(inRuntimeTransaction(runtime, ids.user, (client) =>
      client.query(
        `INSERT INTO "research"."Research"
          ("id", "organizationId", "projectId", "title", "brief", "createdByUserId")
         VALUES ($1, $2, $3, 'Blocked insert', '', $4)`,
        [`${prefix}-blocked`, ids.organizationB, ids.projectC, ids.user],
      ),
    )).rejects.toMatchObject({ code: "42501" });

    const update = await inRuntimeTransaction(runtime, ids.user, (client) =>
      client.query(
        'UPDATE "research"."Research" SET "title" = \'Blocked update\' WHERE "id" = $1',
        [ids.researchC],
      ),
    );
    expect(update.rowCount).toBe(0);

    const unchanged = await owner.pool.query<{ title: string }>(
      'SELECT "title" FROM "research"."Research" WHERE "id" = $1',
      [ids.researchC],
    );
    expect(unchanged.rows[0]?.title).toBe(ids.researchC);
  });
});

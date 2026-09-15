import { Pool } from "pg";
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
const probeFunction = 'platform."rls_security_definer_boundary_probe"';

integrationDescription("RLS SECURITY DEFINER boundary", () => {
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
    if (process.env.TEST_RUNTIME_DATABASE_USER !== "ams_web") {
      throw new Error("SECURITY DEFINER boundary proof requires the real ams_web role");
    }
    await owner.pool.query(`DROP FUNCTION IF EXISTS ${probeFunction}()`);
    await owner.pool.query(`
      CREATE FUNCTION ${probeFunction}()
      RETURNS BIGINT
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = research, platform, pg_catalog, pg_temp
      AS 'SELECT count(*) FROM research."Run"'
    `);
    await owner.pool.query(`REVOKE ALL ON FUNCTION ${probeFunction}() FROM PUBLIC`);
    await owner.pool.query(`GRANT EXECUTE ON FUNCTION ${probeFunction}() TO ams_web`);

    runtime = new Pool({
      host: process.env.TEST_DATABASE_HOST,
      port: Number(process.env.TEST_DATABASE_PORT ?? "5432"),
      user: process.env.TEST_RUNTIME_DATABASE_USER,
      password: process.env.TEST_RUNTIME_DATABASE_PASSWORD,
      database: process.env.TEST_DATABASE_NAME,
      ssl: process.env.TEST_DATABASE_SSLMODE === "require" ? { rejectUnauthorized: true } : false,
      max: 1,
    });
  });

  afterAll(async () => {
    if (runtime) await runtime.end();
    if (owner) {
      await owner.pool.query(`DROP FUNCTION IF EXISTS ${probeFunction}()`);
      await owner.close();
    }
  });

  it("does not expose tenant rows through a schema-owner SECURITY DEFINER wrapper", async () => {
    const ownerCount = await owner.pool.query<{ count: string }>('SELECT count(*) AS count FROM research."Run"');
    expect(Number(ownerCount.rows[0]?.count ?? 0)).toBeGreaterThan(0);

    try {
      const result = await runtime.query<{ count: string }>(`SELECT ${probeFunction}() AS count`);
      expect(Number(result.rows[0]?.count ?? 0)).toBe(0);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as NodeJS.ErrnoException).code).toMatch(/^(42501|P0001)$/);
    }
  });
});

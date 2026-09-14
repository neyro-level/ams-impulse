import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createPgPoolConfig } from "../src/platform/database/prisma/pool-config.ts";

const database = new Pool(createPgPoolConfig(process.env.DATABASE_URL ?? "", "migrator"));

afterAll(async () => {
  await database.end();
});

describe("platform schema privileges", () => {
  it("denies PUBLIC schema usage while preserving explicit web and worker access", async () => {
    const result = await database.query<{
      publicUsage: boolean;
      webUsage: boolean;
      workerUsage: boolean;
      publicHelperExecution: boolean;
    }>(`
      SELECT
        EXISTS (
          SELECT 1
          FROM pg_namespace AS namespace
          CROSS JOIN LATERAL aclexplode(
            COALESCE(namespace.nspacl, acldefault('n', namespace.nspowner))
          ) AS privilege
          WHERE namespace.nspname = 'platform'
            AND privilege.grantee = 0
            AND privilege.privilege_type = 'USAGE'
        ) AS "publicUsage",
        has_schema_privilege('ams_web', 'platform', 'USAGE') AS "webUsage",
        has_schema_privilege('ams_worker', 'platform', 'USAGE') AS "workerUsage",
        has_function_privilege(
          'public',
          'platform.can_access_tools_project(text,text)',
          'EXECUTE'
        ) AS "publicHelperExecution"
    `);

    expect(result.rows[0]).toEqual({
      publicUsage: false,
      webUsage: true,
      workerUsage: true,
      publicHelperExecution: false,
    });
  });
});

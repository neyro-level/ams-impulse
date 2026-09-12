import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TENANT_OWNED_MODELS } from "../src/platform/database/tenant-owned-models.ts";

const migration = readFileSync(
  new URL("../prisma/migrations/20260911170000_add_product_schemas_and_rls/migration.sql", import.meta.url),
  "utf8",
);
const roles = readFileSync(new URL("../ops/postgres/roles.sql", import.meta.url), "utf8");
const policyGapMigration = readFileSync(
  new URL("../prisma/migrations/20260912130000_close_rls_policy_gaps/migration.sql", import.meta.url),
  "utf8",
);

describe("PostgreSQL RLS foundation", () => {
  it("creates every approved product schema", () => {
    for (const schema of ["platform", "seo", "leads", "tools", "research", "contracts", "invoices", "presentations", "site_clone", "ops", "pgboss"]) {
      expect(migration).toContain(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    }
  });

  it("forces RLS and resolves SEO access from current user grants", () => {
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("current_setting('ams.user_id', true)");
    expect(migration).toContain('JOIN "SeoProjectAccess" AS access');
    expect(migration).toContain('app_user."disabledAt" IS NULL');
  });

  it("keeps runtime identities non-owner and unable to bypass RLS", () => {
    expect(roles).toContain("required database role % does not exist");
    expect(roles).toContain("runtime database role attributes are unsafe");
    expect(roles).toContain("rolbypassrls");
    expect(roles).toContain("managed runtime roles must not inherit membership from another role");
    expect(roles).toContain("managed runtime roles must not own schemas or relations");
    expect(roles).not.toContain("CREATE ROLE");
  });

  it("keeps pg-boss write access worker-only", () => {
    expect(roles).toContain("REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I FROM ams_web");
    expect(roles).toContain("GRANT USAGE ON SCHEMA %I TO ams_worker, ams_backup");
    expect(roles).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO ams_worker");
    expect(roles).toContain('GRANT EXECUTE ON FUNCTION "platform"."stale_research_run_scopes"(timestamptz)');
  });

  it("mentions every registered tenant-owned model in the effective RLS migrations", () => {
    const effectiveRlsSql = `${migration}\n${policyGapMigration}`;
    for (const model of TENANT_OWNED_MODELS) {
      expect(
        effectiveRlsSql.includes(`"${model}"`) || effectiveRlsSql.includes(`'${model}'`),
        model,
      ).toBe(true);
    }
  });

  it("protects SyncRun and reserves access-registry writes for Platform Admin", () => {
    expect(policyGapMigration).toContain('ALTER TABLE "public"."SyncRun" ENABLE ROW LEVEL SECURITY');
    expect(policyGapMigration).toContain('ALTER TABLE "public"."SyncRun" FORCE ROW LEVEL SECURITY');
    expect(policyGapMigration).toContain('CREATE POLICY "sync_run_scope"');
    for (const policy of [
      "seo_project_access_insert",
      "seo_project_access_update",
      "seo_project_access_delete",
      "tools_project_access_insert",
      "tools_project_access_update",
      "tools_project_access_delete",
      "tools_membership_insert",
      "tools_membership_update",
      "tools_membership_delete",
      "tools_organization_insert",
      "tools_organization_update",
      "tools_organization_delete",
    ]) {
      expect(policyGapMigration).toContain(`CREATE POLICY "${policy}"`);
    }
    expect(policyGapMigration).toContain('"platform"."is_platform_admin"()');
  });

  it("avoids recursive FORCE RLS in security-definer lookup relations", () => {
    for (const relation of [
      '"public"."Site"',
      '"public"."SeoProjectAccess"',
      '"tools"."ToolsMembership"',
      '"tools"."ToolsProjectAccess"',
    ]) {
      expect(policyGapMigration).toContain(`ALTER TABLE ${relation} NO FORCE ROW LEVEL SECURITY`);
    }
    expect(policyGapMigration).toContain("SET search_path = public, tools, pg_catalog, pg_temp");
    expect(policyGapMigration).toContain("SET search_path = public, platform, pg_catalog, pg_temp");
    expect(policyGapMigration).toContain("relation.relowner <> routine.proowner");
  });
});

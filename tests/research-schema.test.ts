import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../prisma/migrations/20260911180000_add_tools_research_domain/migration.sql", import.meta.url), "utf8");
const workerSql = readFileSync(
  new URL("../prisma/migrations/20260911200000_add_research_job_rls_context/migration.sql", import.meta.url),
  "utf8",
);
const oauthSql = readFileSync(
  new URL("../prisma/migrations/20260911193000_add_mcp_oauth/migration.sql", import.meta.url),
  "utf8",
);
const oauthDcrFixSql = readFileSync(
  new URL("../prisma/migrations/20260911213000_fix_oauth_dcr_optional_arrays/migration.sql", import.meta.url),
  "utf8",
);
const oauthTokenArrayFixSql = readFileSync(
  new URL("../prisma/migrations/20260911222500_fix_oauth_optional_array_defaults/migration.sql", import.meta.url),
  "utf8",
);
const researchAuditScopeSql = readFileSync(
  new URL("../prisma/migrations/20260912120000_scope_research_audit_events/migration.sql", import.meta.url),
  "utf8",
);

describe("Tools and Research database contract", () => {
  it("uses independent membership and explicit project grants", () => {
    expect(sql).toContain('CREATE TABLE "tools"."ToolsMembership"');
    expect(sql).toContain('CREATE TABLE "tools"."ToolsProjectAccess"');
    expect(sql).toContain('UNIQUE ("membershipId", "projectId")');
  });

  it("prevents cross-project research relations with composite foreign keys", () => {
    expect(sql).toContain('FOREIGN KEY ("organizationId", "projectId", "researchId")');
    expect(sql).toContain('FOREIGN KEY ("organizationId", "projectId", "runId")');
    expect(sql).toContain('FOREIGN KEY ("organizationId", "projectId", "queryRunId")');
  });

  it("forces RLS and caps every run at twenty queries", () => {
    expect(sql).toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toContain('CHECK ("queryCount" BETWEEN 1 AND 20)');
    expect(sql).toContain('"platform"."can_access_tools_project"');
  });

  it("scopes ToolsProject by its own id rather than a nonexistent projectId", () => {
    expect(sql).toContain('ON "tools"."ToolsProject"');
    expect(sql).toContain('"can_access_tools_project"("organizationId", id)');
    expect(sql).not.toContain(`'tools."ToolsProject"'::REGCLASS`);
    expect(workerSql).toContain('ON "tools"."ToolsProject"');
    expect(workerSql).toContain('"worker_can_access_tools_project"("organizationId", id)');
    expect(workerSql).not.toContain(`'tools."ToolsProject"'::REGCLASS`);
  });

  it("lets Better Auth seed an OAuth resource without explicit scopes", () => {
    expect(oauthSql).toContain('"allowedScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]');
  });

  it("lets dynamic OAuth clients omit optional array metadata", () => {
    expect(oauthDcrFixSql).toContain('ALTER COLUMN "contacts" SET DEFAULT ARRAY[]::TEXT[]');
    expect(oauthDcrFixSql).toContain('ALTER COLUMN "postLogoutRedirectUris" SET DEFAULT ARRAY[]::TEXT[]');
  });

  it("defaults every optional OAuth token and consent array", () => {
    expect(oauthTokenArrayFixSql).toContain('ALTER TABLE "public"."oauthRefreshToken"');
    expect(oauthTokenArrayFixSql).toContain('ALTER TABLE "public"."oauthAccessToken"');
    expect(oauthTokenArrayFixSql).toContain('ALTER TABLE "public"."oauthConsent"');
    expect(oauthTokenArrayFixSql.match(/SET DEFAULT ARRAY\[\]::TEXT\[\]/g)).toHaveLength(9);
  });

  it("requires complete product-local scope for Research audit events", () => {
    expect(researchAuditScopeSql).toContain('DROP CONSTRAINT "AuditEvent_organizationId_fkey"');
    expect(researchAuditScopeSql).toContain('"productCode" = \'tools\'');
    expect(researchAuditScopeSql).toContain('"organizationId" IS NOT NULL');
    expect(researchAuditScopeSql).toContain('"projectId" IS NOT NULL');
  });
});

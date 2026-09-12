import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../prisma/migrations/20260912140000_expire_research_estimates/migration.sql", import.meta.url),
  "utf8",
);
const repository = readFileSync(
  new URL("../src/modules/research/infrastructure/prisma-research-repository.ts", import.meta.url),
  "utf8",
);

describe("Research budget lifecycle contract", () => {
  it("counts active reservations, approved work and terminal actual spend", () => {
    expect(migration).toContain("run.\"status\" = 'AWAITING_CONFIRMATION'");
    expect(migration).toContain("run.\"estimateExpiresAt\" > reference_time");
    expect(migration).toContain("run.\"status\" IN ('QUEUED', 'RUNNING')");
    expect(migration).toContain("run.\"status\" IN ('SUCCEEDED', 'FAILED')");
    expect(migration).toContain("COALESCE(run.\"actualCostKopecks\", 0)");
    expect(migration).not.toContain("'CANCELLED'");
  });

  it("expires stale estimates before reading committed spend", () => {
    expect(repository).toContain("SET \"status\"='CANCELLED'");
    expect(repository).toContain("RESEARCH_ESTIMATE_EXPIRED");
    expect(repository.indexOf("SET \"status\"='CANCELLED'")).toBeLessThan(
      repository.indexOf('"platform"."research_committed_spend"'),
    );
  });

  it("adds the budget lookup index", () => {
    expect(migration).toContain(
      '"Run"("organizationId", "projectId", "status", "estimateExpiresAt")',
    );
  });

  it("counts the estimate being confirmed exactly once", () => {
    expect(repository).toContain('AS "currentRunInDailyWindow"');
    expect(repository).toContain('AS "currentRunInMonthlyWindow"');
    expect(repository).toContain(
      "- (currentSpend?.currentRunInDailyWindow ? run.estimatedCostKopecks : 0)",
    );
    expect(repository).toContain(
      "- (currentSpend?.currentRunInMonthlyWindow ? run.estimatedCostKopecks : 0)",
    );
  });
});

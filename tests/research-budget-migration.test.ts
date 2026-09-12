import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../prisma/migrations/20260911210000_serialize_research_budget/migration.sql", import.meta.url),
  "utf8",
);
const repository = readFileSync(
  new URL("../src/modules/research/infrastructure/prisma-research-repository.ts", import.meta.url),
  "utf8",
);

describe("Research budget serialization", () => {
  it("aggregates organization spend behind an authorized project", () => {
    expect(migration).toContain('"platform"."research_committed_spend"');
    expect(migration).toContain('run."organizationId" = target_organization_id');
    expect(migration).toContain('"platform"."can_access_tools_project"');
  });

  it("locks each organization and rechecks limits during reservation and confirmation", () => {
    expect(repository.match(/pg_advisory_xact_lock/g)).toHaveLength(2);
    expect(repository).toContain("reserveRunEstimate");
    expect(repository).toContain("RESEARCH_DAILY_LIMIT_EXCEEDED");
    expect(repository).toContain("RESEARCH_MONTHLY_LIMIT_EXCEEDED");
  });
});

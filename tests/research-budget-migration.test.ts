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
const terminalSpendMigration = readFileSync(
  new URL("../prisma/migrations/20260913160000_harden_research_runtime_invariants/migration.sql", import.meta.url),
  "utf8",
);
const utcBudgetMigration = readFileSync(
  new URL("../prisma/migrations/20260913190000_unify_research_budget_utc/migration.sql", import.meta.url),
  "utf8",
);
const allocatedCostMigration = readFileSync(
  new URL("../prisma/migrations/20260913191000_rename_research_allocated_cost/migration.sql", import.meta.url),
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

  it("keeps live estimates reserved while charging actual terminal spend", () => {
    expect(terminalSpendMigration).toContain("run.\"status\" = 'AWAITING_CONFIRMATION'");
    expect(terminalSpendMigration).toContain('run."estimateExpiresAt" > reference_time');
    expect(terminalSpendMigration).toContain("run.\"status\" IN ('SUCCEEDED', 'PARTIAL', 'FAILED')");
    expect(terminalSpendMigration).toContain('COALESCE(run."actualCostKopecks", 0)');
  });

  it("uses explicit UTC budget windows independent of the database session timezone", () => {
    expect(utcBudgetMigration).toContain('"platform"."research_budget_boundaries"');
    expect(utcBudgetMigration).toContain("reference_time AT TIME ZONE 'UTC'");
    expect(utcBudgetMigration).toContain("date_trunc('day'");
    expect(utcBudgetMigration).toContain("date_trunc('month'");
    expect(repository).toContain('boundaries."dayStart"');
    expect(repository).toContain('boundaries."monthStart"');
    expect(repository).not.toContain("date_trunc('day', ${input.now}");
  });

  it("names estimated allocations honestly without rewriting migration history", () => {
    expect(allocatedCostMigration).toContain('RENAME COLUMN "actualCostKopecks" TO "allocatedCostKopecks"');
    expect(allocatedCostMigration).toContain('RENAME COLUMN "costKopecks" TO "allocatedCostKopecks"');
    expect(allocatedCostMigration).toContain('COALESCE(run."allocatedCostKopecks", 0)');
    expect(terminalSpendMigration).toContain('COALESCE(run."actualCostKopecks", 0)');
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repository = readFileSync(
  new URL("../src/modules/research/infrastructure/prisma-research-execution-repository.ts", import.meta.url),
  "utf8",
);

describe("Research failed-run settlement", () => {
  it("closes unexecuted query rows without assigning an allocation and settles started failures", () => {
    expect(repository).toContain(`"status" IN ('PENDING','RUNNING')`);
    expect(repository).toContain(`WHEN "status"='PENDING' THEN 'RESEARCH_RUN_ABORTED'`);
    const terminalQueryUpdates = (repository.match(/UPDATE "research"\."QueryRun"[^`]+/g) ?? [])
      .filter((statement) => statement.includes(`"status" IN ('PENDING','RUNNING')`));
    expect(terminalQueryUpdates.length).toBeGreaterThanOrEqual(2);
    expect(terminalQueryUpdates.every((statement) => !statement.includes(`"allocatedCostKopecks"`))).toBe(true);
    expect(repository).toContain(`SET "status"='FAILED', "allocatedCostKopecks"=${'${allocatedCostKopecks}'}`);
  });

  it("persists allocated spend as the sum of recorded query allocations on failure", () => {
    const failedRunUpdate = repository.match(/UPDATE "research"\."Run" SET "status"='FAILED'[^`]+/g) ?? [];
    expect(failedRunUpdate.length).toBeGreaterThanOrEqual(2);
    expect(failedRunUpdate.every((statement) => statement.includes(`COALESCE(SUM("allocatedCostKopecks"),0)`))).toBe(true);
  });
});

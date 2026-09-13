import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import type { PrismaClient } from "../src/generated/prisma/client.ts";
import {
  PrismaResearchExecutionRepository,
  RESEARCH_EVIDENCE_BATCH_SIZE,
} from "../src/modules/research/infrastructure/prisma-research-execution-repository.ts";

describe("Research evidence persistence", () => {
  it("uses bounded parameterized multi-row inserts", async () => {
    expect(RESEARCH_EVIDENCE_BATCH_SIZE).toBeGreaterThanOrEqual(200);
    expect(RESEARCH_EVIDENCE_BATCH_SIZE).toBeLessThanOrEqual(500);

    const source = await readFile(
      "src/modules/research/infrastructure/prisma-research-execution-repository.ts",
      "utf8",
    );
    expect(source).toContain("Prisma.join(batch.map");
    expect(source).toContain("VALUES ${values}");
    expect(source).not.toContain("for (const evidence of input.search)");
    expect(source).not.toContain("for (const evidence of input.wordstat)");
  });

  it("persists 501 evidence rows with three batch statements", async () => {
    const transaction = {
      $queryRaw: vi.fn(async () => [{ organizationId: "org-1", projectId: "project-1" }]),
      $executeRaw: vi.fn(async () => 1),
    };
    const prisma = {
      $transaction: vi.fn(async (operation: (tx: typeof transaction) => Promise<unknown>) => operation(transaction)),
    } as unknown as PrismaClient;
    const repository = new PrismaResearchExecutionRepository(
      { organizationId: "org-1", projectId: "project-1" },
      prisma,
    );

    await repository.completeQuery({
      queryRunId: "query-run-1",
      search: Array.from({ length: 501 }, (_, index) => ({
        type: "organic" as const,
        url: `https://example.test/${index}`,
        domain: "example.test",
        title: `Result ${index}`,
        snippet: null,
      })),
      wordstat: [],
      allocatedCostKopecks: 100,
    });

    // One context statement, three evidence batches and one QueryRun update.
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(5);
  });
});

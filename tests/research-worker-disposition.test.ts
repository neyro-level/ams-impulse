import { describe, expect, it, vi } from "vitest";

import { RESEARCH_RUN_QUEUE } from "../src/modules/research/index.ts";
import { runNextResearchJobWithDependencies } from "../src/modules/research/worker.ts";

const data = {
  schemaVersion: 1 as const,
  toolsOrganizationId: "org-1",
  toolsProjectId: "project-1",
  researchId: "research-1",
  runId: "run-1",
  correlationId: "9aca2537-b25c-484d-9072-7fced2cf40d9",
};

describe("research queue disposition", () => {
  it("creates exactly one future delivery and completes a lock-deferred job", async () => {
    const queue = {
      fetch: vi.fn().mockResolvedValue([{ id: "job-1", data }]),
      send: vi.fn().mockResolvedValue("job-2"),
      complete: vi.fn().mockResolvedValue(undefined),
    };

    const result = await runNextResearchJobWithDependencies(queue as never, async () => ({
      execute: async () => ({ status: "deferred" as const }),
    }) as never);

    expect(result).toEqual({ handled: 1, status: "deferred" });
    expect(queue.send).toHaveBeenCalledTimes(1);
    expect(queue.send).toHaveBeenCalledWith(RESEARCH_RUN_QUEUE, data, { startAfter: 1 });
    expect(queue.complete).toHaveBeenCalledTimes(1);
    expect(queue.complete).toHaveBeenCalledWith(RESEARCH_RUN_QUEUE, "job-1", { status: "deferred", code: "RUN_LOCK_BUSY" });
  });
});

import { describe, expect, it } from "vitest";
import { ResearchProviderError, type ClaimedResearchRun, type ResearchExecutionRepository, type ResearchProvider } from "../src/modules/research/index.ts";
import { ResearchExecutionService, recoverStaleResearchRunsWithDependencies } from "../src/modules/research/worker.ts";

class ExecutionRepository implements ResearchExecutionRepository {
  run: ClaimedResearchRun | null = { runId: "run-1", organizationId: "org-1", projectId: "project-1", researchId: "research-1", approvedCostKopecks: 200, queries: [{ queryRunId: "qr-1", queryId: "q-1", text: "купить квартиру" }, { queryRunId: "qr-2", queryId: "q-2", text: "цены на жильё" }] };
  started: string[] = []; completed: string[] = []; costs: number[] = []; failed: Array<[string, string]> = []; runStatus = "QUEUED";
  async failStaleRuns() { return 0; }
  async claimRun() { if (this.runStatus !== "QUEUED") return null; this.runStatus = "RUNNING"; return this.run; }
  async markQueryStarted(id: string) { this.started.push(id); return true; }
  async completeQuery(input: { queryRunId: string; costKopecks: number }) { this.completed.push(input.queryRunId); this.costs.push(input.costKopecks); }
  async failQuery(id: string, code: string) { this.failed.push([id, code]); }
  async completeRun() { this.runStatus = "SUCCEEDED"; }
  async failRun(_id: string, code: string) { this.runStatus = `FAILED:${code}`; }
}

const provider: ResearchProvider = {
  collectYandexSerp: async ({ query }) => [{ type: "organic", url: "https://example.test", domain: "example.test", title: query, snippet: null }],
  collectYandexSuggestions: async () => [],
  collectWordstat: async ({ query }) => [{ phrase: query, monthlyCount: 100, association: false }],
  getProviderHealth: async () => ({ available: true, code: "OK" }),
};

describe("ResearchExecutionService", () => {
  it("runs each query sequentially and completes the durable run", async () => {
    const repository = new ExecutionRepository();
    const result = await new ResearchExecutionService(repository, provider).execute("run-1");
    expect(result).toEqual({ status: "succeeded" });
    expect(repository.started).toEqual(["qr-1", "qr-2"]);
    expect(repository.completed).toEqual(["qr-1", "qr-2"]);
    expect(repository.costs).toEqual([100, 100]);
    expect(repository.runStatus).toBe("SUCCEEDED");
  });

  it("distributes a minor-unit remainder without losing or creating money", async () => {
    const repository = new ExecutionRepository();
    repository.run = { ...repository.run!, approvedCostKopecks: 201 };

    await new ResearchExecutionService(repository, provider).execute("run-1");

    expect(repository.costs).toEqual([101, 100]);
    expect(repository.costs.reduce((sum, value) => sum + value, 0)).toBe(201);
  });

  it("stops after an ambiguous paid failure and does not call the next query", async () => {
    const repository = new ExecutionRepository(); let calls = 0;
    const failingProvider: ResearchProvider = { ...provider, collectYandexSerp: async () => { calls += 1; throw new ResearchProviderError("PROVIDER_TIMEOUT_AMBIGUOUS", "AMBIGUOUS_AFTER_DISPATCH"); } };
    const result = await new ResearchExecutionService(repository, failingProvider).execute("run-1");
    expect(result).toEqual({ status: "failed", code: "PROVIDER_RESULT_AMBIGUOUS" });
    expect(calls).toBe(1);
    expect(repository.started).toEqual(["qr-1"]);
    expect(repository.runStatus).toBe("FAILED:PROVIDER_RESULT_AMBIGUOUS");
  });

  it("recovers an interrupted run after restart without repeating a paid call", async () => {
    const repository = new ExecutionRepository();
    repository.runStatus = "RUNNING";
    let providerCalls = 0;
    const restartedProvider: ResearchProvider = {
      ...provider,
      collectYandexSerp: async () => { providerCalls += 1; return []; },
    };

    const recovered = await recoverStaleResearchRunsWithDependencies(
      new Date("2026-09-12T12:00:00.000Z"),
      async () => [{ organizationId: "org-1", projectId: "project-1" }],
      async () => { repository.runStatus = "FAILED:WORKER_INTERRUPTED_AMBIGUOUS"; return 1; },
    );
    const result = await new ResearchExecutionService(repository, restartedProvider).execute("run-1");

    expect(recovered).toBe(1);
    expect(result).toEqual({ status: "ignored" });
    expect(providerCalls).toBe(0);
    expect(repository.runStatus).toBe("FAILED:WORKER_INTERRUPTED_AMBIGUOUS");
  });

  it("ignores duplicate queue delivery after the run leaves QUEUED", async () => {
    const repository = new ExecutionRepository(); const service = new ResearchExecutionService(repository, provider);
    await service.execute("run-1");
    await expect(service.execute("run-1")).resolves.toEqual({ status: "ignored" });
  });

  it("retries one explicitly retryable rejection", async () => {
    const repository = new ExecutionRepository(); let calls = 0;
    const retryingProvider: ResearchProvider = {
      ...provider,
      collectYandexSerp: async ({ query }) => {
        calls += 1;
        if (calls === 1) throw new ResearchProviderError("PROVIDER_REJECTED", "DEFINITELY_NOT_CHARGED");
        return [{ type: "organic", url: "https://example.test", domain: "example.test", title: query, snippet: null }];
      },
    };
    const result = await new ResearchExecutionService(repository, retryingProvider, async () => undefined).execute("run-1");
    expect(result).toEqual({ status: "succeeded" });
    expect(calls).toBe(3);
  });
});

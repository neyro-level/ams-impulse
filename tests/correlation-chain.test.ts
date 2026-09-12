import { describe, expect, it, vi } from "vitest";
import { resolveCorrelationId } from "../src/platform/http/correlation.ts";
import { ResearchExecutionService } from "../src/modules/research/application/research-execution-service.ts";

const correlationId = "00000000-0000-4000-8000-000000000511";

describe("end-to-end correlation chain", () => {
  it("accepts only a valid inbound correlation id", () => {
    expect(resolveCorrelationId(new Headers({ "x-correlation-id": correlationId }))).toBe(correlationId);
    expect(resolveCorrelationId(new Headers({ "x-correlation-id": "unsafe value" }))).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });

  it("propagates the async job correlation id into every provider call", async () => {
    const repository = {
      claimRun: vi.fn(async () => ({
        runId: "run-1",
        organizationId: "org-1",
        projectId: "project-1",
        researchId: "research-1",
        approvedCostKopecks: 3,
        queries: [{ queryRunId: "query-run-1", queryId: "query-1", text: "sensitive query" }],
      })),
      failStaleRuns: vi.fn(),
      markQueryStarted: vi.fn(async () => true),
      completeQuery: vi.fn(),
      failQuery: vi.fn(),
      completeRun: vi.fn(),
      failRun: vi.fn(),
    };
    const provider = {
      collectYandexSerp: vi.fn(async () => []),
      collectYandexSuggestions: vi.fn(async () => []),
      collectWordstat: vi.fn(async () => []),
      getProviderHealth: vi.fn(async () => ({ available: true, code: "CONFIGURED" })),
    };

    await new ResearchExecutionService(repository, provider).execute("run-1", correlationId);

    const expected = { query: "sensitive query", correlationId };
    expect(provider.collectYandexSerp).toHaveBeenCalledWith(expected);
    expect(provider.collectYandexSuggestions).toHaveBeenCalledWith(expected);
    expect(provider.collectWordstat).toHaveBeenCalledWith(expected);
  });
});

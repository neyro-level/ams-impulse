import type { ResearchExecutionRepository } from "./ports/research-execution-repository.ts";
import type { ResearchProvider } from "./ports/research-provider.ts";

function safeProviderCode(error: unknown) {
  if (error && typeof error === "object" && "category" in error && error.category === "AMBIGUOUS_AFTER_DISPATCH") {
    return "PROVIDER_RESULT_AMBIGUOUS";
  }
  return error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : "RESEARCH_PROVIDER_FAILED";
}

export class ResearchExecutionService {
  constructor(
    private readonly repository: ResearchExecutionRepository,
    private readonly provider: ResearchProvider,
    private readonly delay: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {}

  private async providerCall<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!error || typeof error !== "object" || !("category" in error)) throw error;
      if (error.category !== "PRE_REQUEST_RETRYABLE" && error.category !== "DEFINITELY_NOT_CHARGED") throw error;
      await this.delay(250);
      return operation();
    }
  }

  async execute(runId: string) {
    const run = await this.repository.claimRun(runId);
    if (!run) return { status: "ignored" as const };
    const queryCount = Math.max(1, run.queries.length);
    const baseCost = Math.floor(run.approvedCostKopecks / queryCount);
    const costRemainder = run.approvedCostKopecks % queryCount;
    try {
      for (const [index, query] of run.queries.entries()) {
        if (!await this.repository.markQueryStarted(query.queryRunId)) continue;
        try {
          const search = await this.providerCall(() => this.provider.collectYandexSerp({ query: query.text }));
          const suggestions = await this.providerCall(() => this.provider.collectYandexSuggestions({ query: query.text }));
          const wordstat = await this.providerCall(() => this.provider.collectWordstat({ query: query.text }));
          const suggestionEvidence = suggestions.map((title) => ({ type: "related" as const, url: null, domain: null, title, snippet: null }));
          const costKopecks = baseCost + (index < costRemainder ? 1 : 0);
          await this.repository.completeQuery({ queryRunId: query.queryRunId, search: [...search, ...suggestionEvidence], wordstat, costKopecks });
        } catch (error) {
          const code = safeProviderCode(error);
          await this.repository.failQuery(query.queryRunId, code);
          await this.repository.failRun(run.runId, code);
          return { status: "failed" as const, code };
        }
      }
      await this.repository.completeRun(run);
      return { status: "succeeded" as const };
    } catch (error) {
      const code = safeProviderCode(error);
      await this.repository.failRun(run.runId, code);
      return { status: "failed" as const, code };
    }
  }
}

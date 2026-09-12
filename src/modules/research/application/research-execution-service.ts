import type { ResearchExecutionRepository } from "./ports/research-execution-repository.ts";
import { silentResearchLifecyclePublisher, type ResearchLifecycleEvent, type ResearchLifecyclePublisher } from "./ports/research-lifecycle-publisher.ts";
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
    private readonly lifecycle: ResearchLifecyclePublisher = silentResearchLifecyclePublisher,
  ) {}

  private async publish(event: ResearchLifecycleEvent, run: { runId: string; organizationId: string; projectId: string; researchId: string }) {
    try {
      await this.lifecycle.publish({ event, runId: run.runId, organizationId: run.organizationId, projectId: run.projectId, researchId: run.researchId });
    } catch {
      // A secondary notification must never rewrite the durable paid-run outcome.
    }
  }

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

  async execute(runId: string, correlationId?: string) {
    const run = await this.repository.claimRun(runId);
    if (!run) return { status: "ignored" as const };
    await this.publish("started", run);
    const queryCount = Math.max(1, run.queries.length);
    const baseCost = Math.floor(run.approvedCostKopecks / queryCount);
    const costRemainder = run.approvedCostKopecks % queryCount;
    try {
      for (const [index, query] of run.queries.entries()) {
        if (!await this.repository.markQueryStarted(query.queryRunId)) continue;
        try {
          const request = { query: query.text, correlationId };
          const search = await this.providerCall(() => this.provider.collectYandexSerp(request));
          const suggestions = await this.providerCall(() => this.provider.collectYandexSuggestions(request));
          const wordstat = await this.providerCall(() => this.provider.collectWordstat(request));
          const suggestionEvidence = suggestions.map((title) => ({ type: "related" as const, url: null, domain: null, title, snippet: null }));
          const costKopecks = baseCost + (index < costRemainder ? 1 : 0);
          await this.repository.completeQuery({ queryRunId: query.queryRunId, search: [...search, ...suggestionEvidence], wordstat, costKopecks });
        } catch (error) {
          const code = safeProviderCode(error);
          await this.repository.failQuery(query.queryRunId, code);
          if (code.includes("AMBIGUOUS")) {
            await this.repository.failRun(run.runId, code);
            await this.publish("failed", run);
            await this.publish("action_required", run);
            return { status: "failed" as const, code };
          }
        }
      }
      const status = await this.repository.completeRun(run);
      await this.publish(status === "partial" ? "partial" : "completed", run);
      if (status === "partial") await this.publish("action_required", run);
      return { status };
    } catch (error) {
      const code = safeProviderCode(error);
      await this.repository.failRun(run.runId, code);
      await this.publish("failed", run);
      await this.publish("action_required", run);
      return { status: "failed" as const, code };
    }
  }
}

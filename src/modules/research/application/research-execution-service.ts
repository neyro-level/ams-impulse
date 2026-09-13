import type { ResearchExecutionRepository } from "./ports/research-execution-repository.ts";
import { silentResearchLifecyclePublisher, type ResearchLifecycleEvent, type ResearchLifecyclePublisher } from "./ports/research-lifecycle-publisher.ts";
import type { ResearchProvider } from "./ports/research-provider.ts";
import { RESEARCH_MAX_PAID_CALLS_PER_RUN, RESEARCH_PAID_CALLS_PER_QUERY } from "../domain/research.ts";

function safeProviderCode(error: unknown) {
  if (error && typeof error === "object" && "category" in error && error.category === "AMBIGUOUS_AFTER_DISPATCH") {
    return "PROVIDER_RESULT_AMBIGUOUS";
  }
  return error && typeof error === "object" && "category" in error && "code" in error && typeof error.code === "string"
    ? error.code
    : "RESEARCH_INTERNAL_FAILURE";
}

const DEFAULT_PROVIDER_RETRY_DELAY_MS = 250;
const MAX_PROVIDER_RETRY_DELAY_MS = 30_000;

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
      const retryAfterMs = "retryAfterMs" in error && typeof error.retryAfterMs === "number"
        ? Math.min(MAX_PROVIDER_RETRY_DELAY_MS, Math.max(0, error.retryAfterMs))
        : DEFAULT_PROVIDER_RETRY_DELAY_MS;
      await this.delay(retryAfterMs);
      return operation();
    }
  }

  async execute(runId: string, correlationId?: string) {
    const claim = await this.repository.claimRun(runId);
    if (claim.status === "lock-busy") return { status: "deferred" as const };
    if (claim.status === "not-claimable") return { status: "ignored" as const };
    const run = claim.run;
    if (run.queries.length * RESEARCH_PAID_CALLS_PER_QUERY > RESEARCH_MAX_PAID_CALLS_PER_RUN) {
      await this.repository.failRun(run.runId, "RESEARCH_PAID_CALL_LIMIT_EXCEEDED");
      return { status: "failed" as const, code: "RESEARCH_PAID_CALL_LIMIT_EXCEEDED" };
    }
    await this.publish("started", run);
    const queryCount = Math.max(1, run.queries.length);
    const baseCost = Math.floor(run.approvedCostKopecks / queryCount);
    const costRemainder = run.approvedCostKopecks % queryCount;
    try {
      for (const [index, query] of run.queries.entries()) {
        if (!await this.repository.markQueryStarted(query.queryRunId)) continue;
        const queryCostKopecks = baseCost + (index < costRemainder ? 1 : 0);
        const providerCallBaseCost = Math.floor(queryCostKopecks / RESEARCH_PAID_CALLS_PER_QUERY);
        const providerCallCostRemainder = queryCostKopecks % RESEARCH_PAID_CALLS_PER_QUERY;
        const providerCallCost = (operationIndex: number) => providerCallBaseCost + (operationIndex < providerCallCostRemainder ? 1 : 0);
        let settledCostKopecks = 0;
        let currentProviderCallCostKopecks = providerCallCost(0);
        try {
          const request = { query: query.text, correlationId };
          const search = await this.providerCall(() => this.provider.collectYandexSerp(request));
          settledCostKopecks += currentProviderCallCostKopecks;
          currentProviderCallCostKopecks = providerCallCost(1);
          const suggestions = await this.providerCall(() => this.provider.collectYandexSuggestions(request));
          settledCostKopecks += currentProviderCallCostKopecks;
          currentProviderCallCostKopecks = providerCallCost(2);
          const wordstat = await this.providerCall(() => this.provider.collectWordstat(request));
          settledCostKopecks += currentProviderCallCostKopecks;
          const suggestionEvidence = suggestions.map((title) => ({ type: "related" as const, url: null, domain: null, title, snippet: null }));
          await this.repository.completeQuery({ queryRunId: query.queryRunId, search: [...search, ...suggestionEvidence], wordstat, costKopecks: settledCostKopecks });
        } catch (error) {
          if (!error || typeof error !== "object" || !("category" in error)) throw error;
          const code = safeProviderCode(error);
          const ambiguousCostKopecks = error.category === "AMBIGUOUS_AFTER_DISPATCH" ? currentProviderCallCostKopecks : 0;
          await this.repository.failQuery(query.queryRunId, code, settledCostKopecks + ambiguousCostKopecks);
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

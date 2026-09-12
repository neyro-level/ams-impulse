import type { AuthorizationService } from "../../../platform/authorization/authorization-service.ts";
import type { PrincipalContext } from "../../../platform/authorization/principal.ts";
import {
  confirmResearchRunInputSchema,
  createResearchInputSchema,
  estimateResearchRunInputSchema,
  ResearchError,
  researchRefSchema,
  updateResearchInputSchema,
  type ResearchRef,
} from "../domain/research.ts";
import type { ResearchRepository } from "./ports/research-repository.ts";
import type { ResearchBudgetPolicy, ResearchPricingPolicy } from "./ports/research-money-policy.ts";
import { deriveResearchEstimateIdempotencyKey } from "../domain/research-idempotency.ts";

function principalUserId(principal: PrincipalContext): string | null {
  return principal.kind === "api-client" || principal.kind === "job" ? null : principal.userId;
}

export class ResearchService {
  constructor(
    private readonly repository: ResearchRepository,
    private readonly authorization: AuthorizationService,
    private readonly pricing: ResearchPricingPolicy,
    private readonly budget: ResearchBudgetPolicy,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async requireAccess(principal: PrincipalContext, permission: "tools:project:read" | "research:create" | "research:update" | "research:estimate" | "research:run", ref: Omit<ResearchRef, "researchId">) {
    const decision = await this.authorization.authorize(principal, permission, { product: "tools", ...ref });
    if (!decision.allowed) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
  }

  async list(principal: PrincipalContext, organizationId: string, projectId: string) {
    await this.requireAccess(principal, "tools:project:read", { organizationId, projectId });
    return this.repository.listByProject(organizationId, projectId);
  }

  async get(principal: PrincipalContext, rawRef: unknown) {
    const ref = researchRefSchema.parse(rawRef);
    await this.requireAccess(principal, "tools:project:read", ref);
    const research = await this.repository.findById(ref);
    if (!research) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
    return research;
  }

  async listRuns(principal: PrincipalContext, rawRef: unknown) {
    const ref = researchRefSchema.parse(rawRef);
    await this.requireAccess(principal, "tools:project:read", ref);
    return this.repository.listRuns(ref);
  }

  async create(principal: PrincipalContext, rawInput: unknown) {
    const input = createResearchInputSchema.parse(rawInput);
    await this.requireAccess(principal, "research:create", input);
    const userId = principalUserId(principal);
    if (!userId) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
    return this.repository.create({ ...input, createdByUserId: userId, correlationId: principal.correlationId });
  }

  async update(principal: PrincipalContext, rawInput: unknown) {
    const input = updateResearchInputSchema.parse(rawInput);
    await this.requireAccess(principal, "research:update", input);
    const current = await this.repository.findById(input);
    if (!current) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
    if (current.version !== input.version) throw new ResearchError("RESEARCH_STALE");
    if (!(["DRAFT", "READY", "FAILED"] as const).includes(current.status as "DRAFT" | "READY" | "FAILED")) {
      throw new ResearchError("RESEARCH_NOT_EDITABLE");
    }
    const actorId = principalUserId(principal);
    if (!actorId) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
    const updated = await this.repository.update({ ...input, actorId, correlationId: principal.correlationId });
    if (!updated) throw new ResearchError("RESEARCH_STALE");
    return updated;
  }

  async archive(principal: PrincipalContext, rawRef: unknown, version: number) {
    const ref = researchRefSchema.parse(rawRef);
    await this.requireAccess(principal, "research:update", ref);
    const actorId = principalUserId(principal);
    if (!actorId) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
    if (!await this.repository.archive({ ...ref, version, actorId, correlationId: principal.correlationId })) throw new ResearchError("RESEARCH_STALE");
  }

  async estimateRun(principal: PrincipalContext, rawInput: unknown) {
    const input = estimateResearchRunInputSchema.parse(rawInput);
    await this.requireAccess(principal, "research:estimate", input);
    const research = await this.repository.findById(input);
    if (!research) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
    const estimatedCostKopecks = this.pricing.estimateRunCostKopecks(research.queries.length);
    if (!Number.isSafeInteger(estimatedCostKopecks) || estimatedCostKopecks < 0) {
      throw new ResearchError("RESEARCH_PRICING_UNAVAILABLE");
    }
    const idempotencyKey = input.idempotencyKey ?? deriveResearchEstimateIdempotencyKey({
      researchId: research.id,
      version: research.version,
      queries: research.queries.map(({ text }) => text),
    });
    const run = await this.repository.reserveRunEstimate({
      ref: input,
      idempotencyKey,
      queryCount: research.queries.length,
      estimatedCostKopecks,
      now: this.now(),
      dailyLimitKopecks: this.budget.dailyLimitKopecks,
      monthlyLimitKopecks: this.budget.monthlyLimitKopecks,
    });
    return {
      runId: run.runId,
      queryCount: research.queries.length,
      estimatedCostKopecks,
      dailyCommittedKopecks: run.dailyCommittedKopecks,
      monthlyCommittedKopecks: run.monthlyCommittedKopecks,
      dailyLimitKopecks: this.budget.dailyLimitKopecks,
      monthlyLimitKopecks: this.budget.monthlyLimitKopecks,
      confirmationRequired: true as const,
    };
  }

  async confirmAndQueue(principal: PrincipalContext, rawInput: unknown) {
    const input = confirmResearchRunInputSchema.parse(rawInput);
    await this.requireAccess(principal, "research:run", input);
    const actorId = principalUserId(principal);
    if (!actorId) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
    const result = await this.repository.confirmRun({
      ref: input,
      runId: input.runId,
      expectedEstimatedCostKopecks: input.expectedEstimatedCostKopecks,
      actorId,
      correlationId: principal.correlationId,
      now: this.now(),
      dailyLimitKopecks: this.budget.dailyLimitKopecks,
      monthlyLimitKopecks: this.budget.monthlyLimitKopecks,
    });
    if (!result) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
    return result;
  }
}

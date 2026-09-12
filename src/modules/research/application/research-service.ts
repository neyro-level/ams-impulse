import type { AuthorizationService } from "../../../platform/authorization/authorization-service.ts";
import type { PrincipalContext } from "../../../platform/authorization/principal.ts";
import {
  cancelResearchRunInputSchema,
  confirmResearchRunInputSchema,
  createResearchInputSchema,
  estimateResearchRunInputSchema,
  ResearchError,
  researchListQuerySchema,
  researchRefSchema,
  updateResearchInputSchema,
  type ResearchRef,
} from "../domain/research.ts";
import type { ResearchBudgetPolicy, ResearchPricingPolicy } from "./ports/research-money-policy.ts";
import type { ResearchRepository } from "./ports/research-repository.ts";
import { createResearchCommands } from "./research-commands.ts";

export class ResearchService {
  private readonly commands;

  constructor(
    private readonly repository: ResearchRepository,
    private readonly authorization: AuthorizationService,
    pricing: ResearchPricingPolicy,
    budget: ResearchBudgetPolicy,
    now: () => Date = () => new Date(),
  ) {
    this.commands = createResearchCommands({ repository, authorization, pricing, budget, now });
  }

  private async requireAccess(principal: PrincipalContext, ref: Omit<ResearchRef, "researchId">) {
    const decision = await this.authorization.authorize(principal, "tools:project:read", { product: "tools", ...ref });
    if (!decision.allowed) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
  }

  async list(principal: PrincipalContext, organizationId: string, projectId: string) {
    await this.requireAccess(principal, { organizationId, projectId });
    return this.repository.listByProject(organizationId, projectId);
  }

  async listWorkItems(principal: PrincipalContext, organizationId: string, projectId: string, rawQuery: unknown) {
    await this.requireAccess(principal, { organizationId, projectId });
    return this.repository.listWorkItems(organizationId, projectId, researchListQuerySchema.parse(rawQuery));
  }

  async get(principal: PrincipalContext, rawRef: unknown) {
    const ref = researchRefSchema.parse(rawRef);
    await this.requireAccess(principal, ref);
    const research = await this.repository.findById(ref);
    if (!research) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
    return research;
  }

  async listRuns(principal: PrincipalContext, rawRef: unknown) {
    const ref = researchRefSchema.parse(rawRef);
    await this.requireAccess(principal, ref);
    return this.repository.listRuns(ref);
  }

  async create(principal: PrincipalContext, rawInput: unknown) { return this.commands.create(principal, createResearchInputSchema.parse(rawInput)); }
  async update(principal: PrincipalContext, rawInput: unknown) { return this.commands.update(principal, updateResearchInputSchema.parse(rawInput)); }
  async archive(principal: PrincipalContext, rawRef: unknown, version: number) { return this.commands.archive(principal, { ...researchRefSchema.parse(rawRef), version }); }
  async estimateRun(principal: PrincipalContext, rawInput: unknown) { return this.commands.estimateRun(principal, estimateResearchRunInputSchema.parse(rawInput)); }
  async confirmAndQueue(principal: PrincipalContext, rawInput: unknown) { return this.commands.confirmAndQueue(principal, confirmResearchRunInputSchema.parse(rawInput)); }
  async cancelRun(principal: PrincipalContext, rawInput: unknown) { return this.commands.cancelRun(principal, cancelResearchRunInputSchema.parse(rawInput)); }
}

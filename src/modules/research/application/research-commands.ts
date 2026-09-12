import type { AuthorizationService } from "../../../platform/authorization/authorization-service.ts";
import type { PrincipalContext } from "../../../platform/authorization/principal.ts";
import { defineCommand } from "../../../platform/commands/define-command.ts";
import {
  archiveResearchInputSchema,
  cancelResearchRunInputSchema,
  confirmResearchRunInputSchema,
  createResearchInputSchema,
  estimateResearchRunInputSchema,
  ResearchError,
  updateResearchInputSchema,
  type ResearchRef,
} from "../domain/research.ts";
import { deriveResearchEstimateIdempotencyKey } from "../domain/research-idempotency.ts";
import type { ResearchBudgetPolicy, ResearchPricingPolicy } from "./ports/research-money-policy.ts";
import type { ResearchRepository } from "./ports/research-repository.ts";

function actorId(principal: PrincipalContext) {
  if (principal.kind === "api-client" || principal.kind === "job") {
    throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
  }
  return principal.userId;
}

async function requireAccess(
  authorization: AuthorizationService,
  principal: PrincipalContext,
  permission: "research:create" | "research:update" | "research:estimate" | "research:run",
  ref: Omit<ResearchRef, "researchId">,
) {
  const decision = await authorization.authorize(principal, permission, { product: "tools", ...ref });
  if (!decision.allowed) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
}

export function createResearchCommands(dependencies: {
  repository: ResearchRepository;
  authorization: AuthorizationService;
  pricing: ResearchPricingPolicy;
  budget: ResearchBudgetPolicy;
  now?: () => Date;
}) {
  const now = dependencies.now ?? (() => new Date());
  const auditScope = (ref: { organizationId: string; projectId: string }) => ({
    organizationId: ref.organizationId,
    projectId: ref.projectId,
  });

  const create = defineCommand({
    name: "research.create",
    input: createResearchInputSchema,
    authorize: (principal: PrincipalContext, input) => requireAccess(dependencies.authorization, principal, "research:create", input),
    execute: async ({ principal, input, transaction }) => {
      const actor = actorId(principal);
      const result = await dependencies.repository.create({ ...input, createdByUserId: actor, correlationId: principal.correlationId }, transaction);
      await dependencies.repository.appendAudit({ ...auditScope(input), actorId: actor, action: "research.create", entityId: result.id, correlationId: principal.correlationId, marker: { toolsOrganizationId: input.organizationId, toolsProjectId: input.projectId, queryCount: input.queries.length } }, transaction);
      return result;
    },
  });

  const update = defineCommand({
    name: "research.update",
    input: updateResearchInputSchema,
    authorize: (principal: PrincipalContext, input) => requireAccess(dependencies.authorization, principal, "research:update", input),
    execute: async ({ principal, input, transaction }) => {
      const current = await dependencies.repository.findById(input, transaction);
      if (!current) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
      if (current.version !== input.version) throw new ResearchError("RESEARCH_STALE");
      if (!( ["DRAFT", "READY", "FAILED"] as const).includes(current.status as "DRAFT" | "READY" | "FAILED")) throw new ResearchError("RESEARCH_NOT_EDITABLE");
      const actor = actorId(principal);
      const result = await dependencies.repository.update({ ...input, actorId: actor, correlationId: principal.correlationId }, transaction);
      if (!result) throw new ResearchError("RESEARCH_STALE");
      await dependencies.repository.appendAudit({ ...auditScope(input), actorId: actor, action: "research.update", entityId: input.researchId, correlationId: principal.correlationId, marker: { toolsOrganizationId: input.organizationId, toolsProjectId: input.projectId, version: input.version + 1, queryCount: input.queries.length } }, transaction);
      return result;
    },
  });

  const archive = defineCommand({
    name: "research.archive",
    input: archiveResearchInputSchema,
    authorize: (principal: PrincipalContext, input) => requireAccess(dependencies.authorization, principal, "research:update", input),
    execute: async ({ principal, input, transaction }) => {
      const actor = actorId(principal);
      if (!await dependencies.repository.archive({ ...input, actorId: actor, correlationId: principal.correlationId }, transaction)) throw new ResearchError("RESEARCH_STALE");
      await dependencies.repository.appendAudit({ ...auditScope(input), actorId: actor, action: "research.archive", entityId: input.researchId, correlationId: principal.correlationId, marker: { toolsOrganizationId: input.organizationId, toolsProjectId: input.projectId, version: input.version + 1 } }, transaction);
    },
  });

  const estimateRun = defineCommand({
    name: "research.run.estimate",
    input: estimateResearchRunInputSchema,
    authorize: (principal: PrincipalContext, input) => requireAccess(dependencies.authorization, principal, "research:estimate", input),
    execute: async ({ principal, input, transaction }) => {
      const research = await dependencies.repository.findById(input, transaction);
      if (!research) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
      const estimatedCostKopecks = dependencies.pricing.estimateRunCostKopecks(research.queries.length);
      if (!Number.isSafeInteger(estimatedCostKopecks) || estimatedCostKopecks < 0) throw new ResearchError("RESEARCH_PRICING_UNAVAILABLE");
      const idempotencyKey = input.idempotencyKey ?? deriveResearchEstimateIdempotencyKey({ researchId: research.id, version: research.version, queries: research.queries.map(({ text }) => text) });
      const run = await dependencies.repository.reserveRunEstimate({ ref: input, idempotencyKey, queryCount: research.queries.length, estimatedCostKopecks, now: now(), dailyLimitKopecks: dependencies.budget.dailyLimitKopecks, monthlyLimitKopecks: dependencies.budget.monthlyLimitKopecks }, transaction);
      await dependencies.repository.appendAudit({ ...auditScope(input), actorId: actorId(principal), action: "research.run.estimate", entityId: run.runId, correlationId: principal.correlationId, marker: { toolsOrganizationId: input.organizationId, toolsProjectId: input.projectId, estimatedCostKopecks } }, transaction);
      return { ...run, queryCount: research.queries.length, estimatedCostKopecks, dailyLimitKopecks: dependencies.budget.dailyLimitKopecks, monthlyLimitKopecks: dependencies.budget.monthlyLimitKopecks, confirmationRequired: true as const };
    },
  });

  const confirmAndQueue = defineCommand({
    name: "research.run.confirm-and-queue",
    input: confirmResearchRunInputSchema,
    authorize: (principal: PrincipalContext, input) => requireAccess(dependencies.authorization, principal, "research:run", input),
    execute: async ({ principal, input, transaction }) => {
      const actor = actorId(principal);
      const result = await dependencies.repository.confirmRun({ ref: input, runId: input.runId, expectedEstimatedCostKopecks: input.expectedEstimatedCostKopecks, actorId: actor, correlationId: principal.correlationId, now: now(), dailyLimitKopecks: dependencies.budget.dailyLimitKopecks, monthlyLimitKopecks: dependencies.budget.monthlyLimitKopecks }, transaction);
      if (!result) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
      await dependencies.repository.appendAudit({ ...auditScope(input), actorId: actor, action: "research.run.confirm", entityId: input.runId, correlationId: principal.correlationId, marker: { toolsOrganizationId: input.organizationId, toolsProjectId: input.projectId, estimatedCostKopecks: input.expectedEstimatedCostKopecks, outboxEventId: result.outboxEventId } }, transaction);
      return result;
    },
  });

  const cancelRun = defineCommand({
    name: "research.run.cancel",
    input: cancelResearchRunInputSchema,
    authorize: (principal: PrincipalContext, input) => requireAccess(dependencies.authorization, principal, "research:run", input),
    execute: async ({ principal, input, transaction }) => {
      const actor = actorId(principal);
      if (!await dependencies.repository.cancelRun({ ...input, actorId: actor, correlationId: principal.correlationId }, transaction)) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
      await dependencies.repository.appendAudit({ ...auditScope(input), actorId: actor, action: "research.run.cancel", entityId: input.runId, correlationId: principal.correlationId, marker: { toolsOrganizationId: input.organizationId, toolsProjectId: input.projectId } }, transaction);
    },
  });

  return { create, update, archive, estimateRun, confirmAndQueue, cancelRun };
}

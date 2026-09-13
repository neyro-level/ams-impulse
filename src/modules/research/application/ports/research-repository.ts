import type { DatabaseTransaction } from "../../../../platform/database/transaction.ts";
import type {
  CreateResearchInput,
  ResearchRecord,
  ResearchListQuery,
  ResearchListResult,
  ResearchRef,
  ResearchRunEstimate,
  ResearchRunSummary,
  UpdateResearchInput,
} from "../../domain/research.ts";

export type ResearchAuditJsonValue =
  | string
  | number
  | boolean
  | null
  | ResearchAuditJsonValue[]
  | { [key: string]: ResearchAuditJsonValue };

export interface ResearchRepository {
  listByProject(organizationId: string, projectId: string): Promise<ResearchRecord[]>;
  listWorkItems(organizationId: string, projectId: string, query: ResearchListQuery): Promise<ResearchListResult>;
  findById(ref: ResearchRef, transaction?: DatabaseTransaction): Promise<ResearchRecord | null>;
  listRuns(ref: ResearchRef): Promise<ResearchRunSummary[]>;
  hasActiveRun(ref: ResearchRef, transaction: DatabaseTransaction): Promise<boolean>;
  create(input: CreateResearchInput & { createdByUserId: string; correlationId: string }, transaction: DatabaseTransaction): Promise<ResearchRecord>;
  update(input: UpdateResearchInput & { actorId: string; correlationId: string }, transaction: DatabaseTransaction): Promise<ResearchRecord | null>;
  archive(ref: ResearchRef & { version: number; actorId: string; correlationId: string }, transaction: DatabaseTransaction): Promise<boolean>;
  reserveRunEstimate(input: {
    ref: ResearchRef;
    idempotencyKey: string;
    queryCount: number;
    estimatedCostKopecks: number;
    now: Date;
    dailyLimitKopecks: number;
    monthlyLimitKopecks: number;
  }, transaction: DatabaseTransaction): Promise<Pick<ResearchRunEstimate, "runId" | "dailyCommittedKopecks" | "monthlyCommittedKopecks">>;
  confirmRun(input: {
    ref: ResearchRef;
    runId: string;
    expectedEstimatedCostKopecks: number;
    actorId: string;
    correlationId: string;
    now: Date;
    dailyLimitKopecks: number;
    monthlyLimitKopecks: number;
  }, transaction: DatabaseTransaction): Promise<{ runId: string; outboxEventId: string } | null>;
  cancelRun(input: ResearchRef & { runId: string; actorId: string; correlationId: string }, transaction: DatabaseTransaction): Promise<"cancelled" | "already-cancelled" | "unsafe-state" | "not-found">;
  appendAudit(input: {
    organizationId: string;
    projectId: string;
    actorId: string;
    action: string;
    entityId: string;
    correlationId: string;
    marker: { [key: string]: ResearchAuditJsonValue };
  }, transaction: DatabaseTransaction): Promise<void>;
}

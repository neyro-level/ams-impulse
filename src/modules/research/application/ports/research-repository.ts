import type {
  CreateResearchInput,
  ResearchRecord,
  ResearchRef,
  ResearchRunEstimate,
  ResearchRunSummary,
  UpdateResearchInput,
} from "../../domain/research.ts";

export interface ResearchRepository {
  listByProject(organizationId: string, projectId: string): Promise<ResearchRecord[]>;
  findById(ref: ResearchRef): Promise<ResearchRecord | null>;
  listRuns(ref: ResearchRef): Promise<ResearchRunSummary[]>;
  create(input: CreateResearchInput & { createdByUserId: string; correlationId: string }): Promise<ResearchRecord>;
  update(input: UpdateResearchInput & { actorId: string; correlationId: string }): Promise<ResearchRecord | null>;
  archive(ref: ResearchRef & { version: number; actorId: string; correlationId: string }): Promise<boolean>;
  reserveRunEstimate(input: {
    ref: ResearchRef;
    idempotencyKey: string;
    queryCount: number;
    estimatedCostKopecks: number;
    now: Date;
    dailyLimitKopecks: number;
    monthlyLimitKopecks: number;
  }): Promise<Pick<ResearchRunEstimate, "runId" | "dailyCommittedKopecks" | "monthlyCommittedKopecks">>;
  confirmRun(input: {
    ref: ResearchRef;
    runId: string;
    expectedEstimatedCostKopecks: number;
    actorId: string;
    correlationId: string;
    now: Date;
    dailyLimitKopecks: number;
    monthlyLimitKopecks: number;
  }): Promise<{ runId: string; outboxEventId: string } | null>;
}

import type { SearchEvidence, WordstatEvidence } from "./research-provider.ts";

export interface ClaimedResearchRun {
  runId: string;
  organizationId: string;
  projectId: string;
  researchId: string;
  approvedCostKopecks: number;
  queries: Array<{ queryRunId: string; queryId: string | null; text: string }>;
}

export interface ResearchExecutionRepository {
  failStaleRuns(startedBefore: Date): Promise<number>;
  claimRun(runId: string): Promise<ClaimedResearchRun | null>;
  markQueryStarted(queryRunId: string): Promise<boolean>;
  completeQuery(input: { queryRunId: string; search: SearchEvidence[]; wordstat: WordstatEvidence[]; costKopecks: number }): Promise<void>;
  failQuery(queryRunId: string, safeErrorCode: string): Promise<void>;
  completeRun(run: ClaimedResearchRun): Promise<"succeeded" | "partial">;
  failRun(runId: string, safeErrorCode: string): Promise<void>;
}

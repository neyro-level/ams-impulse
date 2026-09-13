import type { SearchEvidence, WordstatEvidence } from "./research-provider.ts";

export interface ClaimedResearchRun {
  runId: string;
  organizationId: string;
  projectId: string;
  researchId: string;
  approvedCostKopecks: number;
  queries: Array<{ queryRunId: string; queryId: string | null; text: string }>;
}

export type ResearchRunClaim =
  | { status: "claimed"; run: ClaimedResearchRun }
  | { status: "not-claimable" }
  | { status: "lock-busy" };

export interface ResearchExecutionRepository {
  failStaleRuns(startedBefore: Date): Promise<number>;
  claimRun(runId: string): Promise<ResearchRunClaim>;
  markQueryStarted(queryRunId: string): Promise<boolean>;
  completeQuery(input: { queryRunId: string; search: SearchEvidence[]; wordstat: WordstatEvidence[]; allocatedCostKopecks: number }): Promise<void>;
  failQuery(queryRunId: string, safeErrorCode: string, allocatedCostKopecks: number): Promise<void>;
  completeRun(run: ClaimedResearchRun): Promise<"succeeded" | "partial">;
  failRun(runId: string, safeErrorCode: string): Promise<void>;
}

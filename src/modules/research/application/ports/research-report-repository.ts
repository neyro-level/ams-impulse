import type { ResearchRef } from "../../domain/research.ts";

export interface ResearchRunReport {
  runId: string;
  status: string;
  estimatedCostKopecks: number;
  approvedCostKopecks: number | null;
  actualCostKopecks: number | null;
  safeErrorCode: string | null;
  createdAt: string;
  finishedAt: string | null;
  queries: Array<{
    query: string;
    status: string;
    costKopecks: number | null;
    evidence: Array<{ type: string; url: string | null; title: string | null; snippet: string | null }>;
  }>;
  competitors: Array<{ domain: string; visibilityScore: number; matchedQueryCount: number }>;
}

export interface ResearchExportRecord {
  exportId: string;
  status: "PENDING" | "READY" | "FAILED" | "EXPIRED";
  objectKey: string | null;
}

export interface ResearchExportReservation extends ResearchExportRecord {
  generationClaimed: boolean;
}

export interface ResearchReportRepository {
  getRunReport(ref: ResearchRef & { runId: string }): Promise<ResearchRunReport | null>;
  reserveExport(input: ResearchRef & { runId: string; idempotencyKey: string; actorId: string }): Promise<ResearchExportReservation>;
  markExportReady(exportId: string, objectKey: string, expiresAt: Date): Promise<void>;
  markExportFailed(exportId: string): Promise<void>;
  getExport(ref: ResearchRef & { exportId: string }): Promise<ResearchExportRecord | null>;
}

export interface PrivateExportStorage {
  putCsv(objectKey: string, body: string): Promise<void>;
  createDownloadUrl(objectKey: string, expiresInSeconds: number): Promise<string>;
}

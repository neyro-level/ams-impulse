import { z } from "zod";

const idSchema = z.string().trim().min(1).max(128);
const titleSchema = z.string().trim().min(2).max(180);
const querySchema = z.string().trim().min(2).max(500);

export const researchStatusSchema = z.enum(["DRAFT", "READY", "RUNNING", "SUCCEEDED", "PARTIAL", "FAILED", "ARCHIVED"]);
export const researchRunStatusSchema = z.enum(["DRAFT", "AWAITING_CONFIRMATION", "QUEUED", "RUNNING", "SUCCEEDED", "PARTIAL", "FAILED", "CANCELLED"]);
export const researchListQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(100).default(""),
  status: researchStatusSchema.nullable().default(null),
  period: z.enum(["all", "7d", "30d", "90d"]).default("all"),
  sort: z.enum(["updated", "title", "status", "cost"]).default("updated"),
});

export const createResearchInputSchema = z.object({
  organizationId: idSchema,
  projectId: idSchema,
  title: titleSchema,
  brief: z.string().trim().max(5000).default(""),
  queries: z.array(querySchema).min(1).max(20),
});

export const updateResearchInputSchema = createResearchInputSchema.omit({ organizationId: true, projectId: true }).extend({
  organizationId: idSchema,
  projectId: idSchema,
  researchId: idSchema,
  version: z.number().int().positive(),
});

export const researchRefSchema = z.object({
  organizationId: idSchema,
  projectId: idSchema,
  researchId: idSchema,
});

export const estimateResearchRunInputSchema = researchRefSchema.extend({
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

export const confirmResearchRunInputSchema = researchRefSchema.extend({
  runId: idSchema,
  expectedEstimatedCostKopecks: z.number().int().min(0),
});

export const archiveResearchInputSchema = researchRefSchema.extend({
  version: z.number().int().positive(),
});

export const cancelResearchRunInputSchema = researchRefSchema.extend({
  runId: idSchema,
});

export type CreateResearchInput = z.infer<typeof createResearchInputSchema>;
export type UpdateResearchInput = z.infer<typeof updateResearchInputSchema>;
export type ResearchRef = z.infer<typeof researchRefSchema>;
export type EstimateResearchRunInput = z.infer<typeof estimateResearchRunInputSchema>;
export type ConfirmResearchRunInput = z.infer<typeof confirmResearchRunInputSchema>;
export type CancelResearchRunInput = z.infer<typeof cancelResearchRunInputSchema>;
export type ResearchStatus = z.infer<typeof researchStatusSchema>;
export type ResearchRunStatus = z.infer<typeof researchRunStatusSchema>;
export type ResearchListQuery = z.infer<typeof researchListQuerySchema>;

export interface ResearchRecord {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  brief: string;
  status: ResearchStatus;
  version: number;
  queries: Array<{ id: string; text: string; position: number }>;
  updatedAt: string;
}

export interface ResearchRunEstimate {
  runId: string;
  queryCount: number;
  estimatedCostKopecks: number;
  dailyCommittedKopecks: number;
  monthlyCommittedKopecks: number;
  dailyLimitKopecks: number;
  monthlyLimitKopecks: number;
  confirmationRequired: true;
}

export interface ResearchRunSummary {
  runId: string;
  status: ResearchRunStatus;
  queryCount: number;
  estimatedCostKopecks: number;
  actualCostKopecks: number | null;
  safeErrorCode: string | null;
  pendingCount: number;
  runningCount: number;
  succeededCount: number;
  failedCount: number;
  createdAt: string;
  finishedAt: string | null;
}

export interface ResearchListItem {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  status: ResearchStatus;
  queryCount: number;
  updatedAt: string;
  lastRun: Pick<ResearchRunSummary, "runId" | "status" | "queryCount" | "estimatedCostKopecks" | "actualCostKopecks" | "safeErrorCode" | "createdAt"> | null;
}

export interface ResearchListResult {
  items: ResearchListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export type ResearchErrorCode =
  | "RESEARCH_NOT_FOUND_OR_FORBIDDEN"
  | "RESEARCH_STALE"
  | "RESEARCH_NOT_EDITABLE"
  | "RESEARCH_ACTIVE_RUN_EXISTS"
  | "RESEARCH_PRICING_UNAVAILABLE"
  | "RESEARCH_IDEMPOTENCY_CONFLICT"
  | "RESEARCH_DAILY_LIMIT_EXCEEDED"
  | "RESEARCH_MONTHLY_LIMIT_EXCEEDED"
  | "RESEARCH_RUN_NOT_CANCELLABLE";

export class ResearchError extends Error {
  constructor(public readonly code: ResearchErrorCode) {
    super(code);
    this.name = "ResearchError";
  }
}

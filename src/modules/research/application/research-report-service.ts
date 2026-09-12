import type { AuthorizationService } from "../../../platform/authorization/authorization-service.ts";
import type { PrincipalContext } from "../../../platform/authorization/principal.ts";
import { z } from "zod";
import { ResearchError, researchRefSchema } from "../domain/research.ts";
import { deriveResearchCsvIdempotencyKey } from "../domain/research-idempotency.ts";
import type { PrivateExportStorage, ResearchReportRepository, ResearchRunReport } from "./ports/research-report-repository.ts";

function actorId(principal: PrincipalContext) {
  return principal.kind === "api-client" || principal.kind === "job" ? null : principal.userId;
}

function csvCell(value: string | number | null) {
  const raw = value === null ? "" : String(value);
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}

function reportToCsv(report: ResearchRunReport) {
  const rows = [["query", "status", "cost_kopecks", "evidence_type", "url", "title", "snippet"]];
  for (const query of report.queries) {
    if (query.evidence.length === 0) rows.push([query.query, query.status, String(query.costKopecks ?? ""), "", "", "", ""]);
    for (const evidence of query.evidence) rows.push([query.query, query.status, String(query.costKopecks ?? ""), evidence.type, evidence.url ?? "", evidence.title ?? "", evidence.snippet ?? ""]);
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

const idempotencyKeySchema = z.string().trim().min(8).max(160);

export class ResearchReportService {
  constructor(
    private readonly repository: ResearchReportRepository,
    private readonly authorization: AuthorizationService,
    private readonly storage: PrivateExportStorage,
  ) {}

  private async require(principal: PrincipalContext, permission: "tools:project:read" | "research:export", ref: { organizationId: string; projectId: string }) {
    const decision = await this.authorization.authorize(principal, permission, { product: "tools", ...ref });
    if (!decision.allowed) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
  }

  async getRun(principal: PrincipalContext, rawInput: unknown) {
    const input = researchRefSchema.extend({ runId: researchRefSchema.shape.researchId }).parse(rawInput);
    await this.require(principal, "tools:project:read", input);
    const report = await this.repository.getRunReport(input);
    if (!report) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
    return report;
  }

  async createExport(principal: PrincipalContext, rawInput: unknown) {
    const input = researchRefSchema.extend({ runId: researchRefSchema.shape.researchId, idempotencyKey: idempotencyKeySchema.optional() }).parse(rawInput);
    await this.require(principal, "research:export", input);
    const userId = actorId(principal); if (!userId) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
    const report = await this.repository.getRunReport(input);
    if (!report || report.status !== "SUCCEEDED") throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
    const reserved = await this.repository.reserveExport({
      ...input,
      idempotencyKey: input.idempotencyKey ?? deriveResearchCsvIdempotencyKey(input.runId),
      actorId: userId,
    });
    const objectKey = reserved.objectKey ?? `research/${input.organizationId}/${input.projectId}/${input.researchId}/${reserved.exportId}.csv`;
    if (reserved.status !== "READY") {
      try {
        await this.storage.putCsv(objectKey, reportToCsv(report));
        await this.repository.markExportReady(reserved.exportId, objectKey, new Date(Date.now() + 24 * 60 * 60 * 1000));
      } catch (error) {
        await this.repository.markExportFailed(reserved.exportId);
        throw error;
      }
    }
    return { exportId: reserved.exportId, status: "READY" as const };
  }

  async createDownload(principal: PrincipalContext, rawInput: unknown) {
    const input = researchRefSchema.extend({ exportId: researchRefSchema.shape.researchId }).parse(rawInput);
    await this.require(principal, "research:export", input);
    const record = await this.repository.getExport(input);
    if (!record || record.status !== "READY" || !record.objectKey) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
    return { url: await this.storage.createDownloadUrl(record.objectKey, 60), expiresInSeconds: 60 as const };
  }
}

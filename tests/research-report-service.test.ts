import { describe, expect, it } from "vitest";
import type { PrivateExportStorage, ResearchReportRepository, ResearchRunReport } from "../src/modules/research/index.ts";
import { ResearchReportService } from "../src/modules/research/server.ts";
import { AuthorizationService } from "../src/platform/authorization/authorization-service.ts";
import { createPlatformAnalystPrincipal, createTenantUserPrincipal } from "./helpers/principal.ts";

const report: ResearchRunReport = { runId: "run-1", status: "SUCCEEDED", estimatedCostKopecks: 100, approvedCostKopecks: 100, allocatedCostKopecks: 100, safeErrorCode: null, createdAt: "2026-09-11T00:00:00.000Z", finishedAt: "2026-09-11T00:01:00.000Z", queries: [{ query: "запрос", status: "SUCCEEDED", allocatedCostKopecks: 100, safeErrorCode: null, startedAt: "2026-09-11T00:00:10.000Z", finishedAt: "2026-09-11T00:00:20.000Z", evidence: [{ type: "organic", url: "https://example.test", title: "Пример", snippet: null }] }], competitors: [] };

class MemoryReports implements ResearchReportRepository {
  status: "PENDING" | "READY" = "PENDING"; objectKey: string | null = null;
  idempotencyKeys: string[] = [];
  async getRunReport() { return report; }
  async reserveExport(input: Parameters<ResearchReportRepository["reserveExport"]>[0]) { this.idempotencyKeys.push(input.idempotencyKey); return { exportId: "export-1", organizationId: "org-1", projectId: "project-1", researchId: "research-1", runId: "run-1", status: this.status, objectKey: this.objectKey, generationClaimed: this.status !== "READY" }; }
  async markExportReady(_id: string, key: string) { this.status = "READY"; this.objectKey = key; }
  async markExportFailed() { return; }
  async getExport() { return { exportId: "export-1", organizationId: "org-1", projectId: "project-1", researchId: "research-1", runId: "run-1", status: this.status, objectKey: this.objectKey }; }
}

const storage: PrivateExportStorage & { body?: string } = {
  async putCsv(_key, body) { this.body = body; },
  async createDownloadUrl() { return "https://storage.test/signed"; },
};
const authorization = new AuthorizationService({ async listProjectGrants(userId) { return userId === "analyst" ? [{ product: "tools", organizationId: "org-1", projectId: "project-1", role: "ANALYST" }] : []; } });

describe("ResearchReportService", () => {
  it("creates a private idempotent CSV export after project authorization", async () => {
    const repository = new MemoryReports();
    const service = new ResearchReportService(repository, authorization, storage);
    const principal = createPlatformAnalystPrincipal("analyst");
    await expect(service.createExport(principal, { organizationId: "org-1", projectId: "project-1", researchId: "research-1", runId: "run-1" })).resolves.toEqual({ exportId: "export-1", status: "READY" });
    await expect(service.createExport(principal, { organizationId: "org-1", projectId: "project-1", researchId: "research-1", runId: "run-1" })).resolves.toEqual({ exportId: "export-1", status: "READY" });
    expect(repository.idempotencyKeys[0]).toBe(repository.idempotencyKeys[1]);
    expect(storage.body).toContain("https://example.test");
    await expect(service.createDownload(principal, { organizationId: "org-1", projectId: "project-1", researchId: "research-1", exportId: "export-1" })).resolves.toEqual({ url: "https://storage.test/signed", expiresInSeconds: 60 });
  });

  it("does not reveal a foreign report or export", async () => {
    const service = new ResearchReportService(new MemoryReports(), authorization, storage);
    const client = createTenantUserPrincipal({ userId: "client", organizationId: "foreign" });
    await expect(service.getRun(client, { organizationId: "org-1", projectId: "project-1", researchId: "research-1", runId: "run-1" })).rejects.toMatchObject({ code: "RESEARCH_NOT_FOUND_OR_FORBIDDEN" });
  });

  it("neutralizes spreadsheet formulas in exported cells", async () => {
    const repository = new MemoryReports();
    const dangerousReport: ResearchRunReport = {
      ...report,
      queries: [{ ...report.queries[0]!, query: "=WEBSERVICE(\"https://example.test\")" }],
    };
    repository.getRunReport = async () => dangerousReport;
    const isolatedStorage: PrivateExportStorage & { body?: string } = {
      async putCsv(_key, body) { this.body = body; },
      async createDownloadUrl() { return "https://storage.test/signed"; },
    };
    const service = new ResearchReportService(repository, authorization, isolatedStorage);
    await service.createExport(createPlatformAnalystPrincipal("analyst"), { organizationId: "org-1", projectId: "project-1", researchId: "research-1", runId: "run-1" });
    expect(isolatedStorage.body).toContain("'=WEBSERVICE");
  });

  it("exports an explicit partial result without inventing missing evidence", async () => {
    const repository = new MemoryReports();
    repository.getRunReport = async () => ({ ...report, status: "PARTIAL", queries: [{ ...report.queries[0]!, status: "FAILED", allocatedCostKopecks: null, evidence: [] }] });
    const isolatedStorage: PrivateExportStorage & { body?: string } = { async putCsv(_key, body) { this.body = body; }, async createDownloadUrl() { return "https://storage.test/signed"; } };
    await new ResearchReportService(repository, authorization, isolatedStorage).createExport(createPlatformAnalystPrincipal("analyst"), { organizationId: "org-1", projectId: "project-1", researchId: "research-1", runId: "run-1", idempotencyKey: "export-003" });
    expect(isolatedStorage.body).toContain('"FAILED"');
    expect(isolatedStorage.body).not.toContain("undefined");
  });

  it("rejects a foreign object key and an unsafe signed URL", async () => {
    const repository = new MemoryReports(); repository.status = "READY"; repository.objectKey = "research/foreign/project/research/export-1.csv";
    const service = new ResearchReportService(repository, authorization, { ...storage, async createDownloadUrl() { return "http://storage.test/signed"; } });
    const principal = createPlatformAnalystPrincipal("analyst");
    await expect(service.createDownload(principal, { organizationId: "org-1", projectId: "project-1", researchId: "research-1", exportId: "export-1" })).rejects.toMatchObject({ code: "RESEARCH_NOT_FOUND_OR_FORBIDDEN" });
    repository.objectKey = "research/org-1/project-1/research-1/export-1.csv";
    await expect(service.createDownload(principal, { organizationId: "org-1", projectId: "project-1", researchId: "research-1", exportId: "export-1" })).rejects.toMatchObject({ code: "RESEARCH_NOT_FOUND_OR_FORBIDDEN" });
  });

  it("allows an HTTP signed URL only for an explicit test loopback endpoint", async () => {
    const repository = new MemoryReports();
    repository.status = "READY";
    repository.objectKey = "research/org-1/project-1/research-1/export-1.csv";
    const loopbackStorage = { ...storage, async createDownloadUrl() { return "http://127.0.0.1:3199/research.csv"; } };
    const principal = createPlatformAnalystPrincipal("analyst");

    await expect(new ResearchReportService(repository, authorization, loopbackStorage).createDownload(principal, {
      organizationId: "org-1", projectId: "project-1", researchId: "research-1", exportId: "export-1",
    })).rejects.toMatchObject({ code: "RESEARCH_NOT_FOUND_OR_FORBIDDEN" });
    await expect(new ResearchReportService(repository, authorization, loopbackStorage, true).createDownload(principal, {
      organizationId: "org-1", projectId: "project-1", researchId: "research-1", exportId: "export-1",
    })).resolves.toEqual({ url: "http://127.0.0.1:3199/research.csv", expiresInSeconds: 60 });
  });
});

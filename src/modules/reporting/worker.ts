import { getWorkerProjectService } from "../project-registry/worker.ts";
import { ReportService } from "./application/report-service.ts";
import { PrismaReportRepository } from "./infrastructure/prisma-report-repository.ts";

export { ReportService } from "./application/report-service.ts";

let reportService: ReportService | null = null;

export function getWorkerReportService() {
  reportService ??= new ReportService(
    getWorkerProjectService(),
    new PrismaReportRepository(),
  );
  return reportService;
}

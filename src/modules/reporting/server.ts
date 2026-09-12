import "server-only";

import { getProjectService } from "../project-registry/server.ts";
import { ReportService } from "./application/report-service.ts";
import { PrismaReportRepository } from "./infrastructure/prisma-report-repository.ts";

export { PrismaReportRepository } from "./infrastructure/prisma-report-repository.ts";
export { ReportService } from "./application/report-service.ts";

let reportService: ReportService | null = null;

export function getReportService() {
  reportService ??= new ReportService(getProjectService(), new PrismaReportRepository());
  return reportService;
}

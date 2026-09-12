import { getWorkerAuthorizationService } from "../identity-access/worker.ts";
import { MonitoringService } from "./application/monitoring-service.ts";
import { ProjectService } from "./application/project-service.ts";
import { PrismaMonitoringRepository } from "./infrastructure/prisma-monitoring-repository.ts";
import { PrismaProjectRepository } from "./infrastructure/prisma-project-repository.ts";

export { PrismaMonitoringRepository } from "./infrastructure/prisma-monitoring-repository.ts";
export { PrismaProjectRepository } from "./infrastructure/prisma-project-repository.ts";
export { MonitoringService } from "./application/monitoring-service.ts";
export { ProjectService } from "./application/project-service.ts";

let projectService: ProjectService | null = null;
let monitoringService: MonitoringService | null = null;

export function getWorkerProjectService() {
  projectService ??= new ProjectService(
    new PrismaProjectRepository(),
    getWorkerAuthorizationService(),
  );
  return projectService;
}

export function getWorkerMonitoringService() {
  monitoringService ??= new MonitoringService(new PrismaMonitoringRepository());
  return monitoringService;
}

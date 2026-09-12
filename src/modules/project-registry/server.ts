import "server-only";

import { getAuthorizationService } from "../identity-access/server.ts";
import { AnalystService } from "./application/analyst-service.ts";
import { MonitoringService } from "./application/monitoring-service.ts";
import { ProjectService } from "./application/project-service.ts";
import { SiteService } from "./application/site-service.ts";
import { PrismaMonitoringRepository } from "./infrastructure/prisma-monitoring-repository.ts";
import { PrismaProjectRepository } from "./infrastructure/prisma-project-repository.ts";

export { PrismaMonitoringRepository } from "./infrastructure/prisma-monitoring-repository.ts";
export { PrismaProjectRepository } from "./infrastructure/prisma-project-repository.ts";
export { AnalystService } from "./application/analyst-service.ts";
export { MonitoringService } from "./application/monitoring-service.ts";
export { ProjectService } from "./application/project-service.ts";
export { SiteService } from "./application/site-service.ts";
export { PrismaProjectRegistryAdminRepository } from "./infrastructure/prisma-platform-admin-repository.ts";
export {
  changeProjectStatus,
  createProject,
  getProject,
  getProjectFormOptions,
  getProjectSummary,
  listProjects,
  updateProjectSettings,
} from "./infrastructure/project-reference-runtime.ts";
export {
  getProjectRegistryAdminFormOptions,
  listGoalDefinitions,
  listProviderConnections,
  listQueryClusterProfiles,
  listSites,
  listThresholdProfiles,
  listTrackedQuerySets,
  saveGoalDefinition,
  confirmMetricaGoals,
  saveProviderConnection,
  saveQueryClusterProfile,
  saveSite,
  saveThresholdProfile,
  saveTrackedQuerySet,
} from "./infrastructure/platform-admin-runtime.ts";
export { searchTopvisorRegions } from "./infrastructure/topvisor-region-runtime.ts";

let services: {
  project: ProjectService;
  analyst: AnalystService;
  site: SiteService;
  monitoring: MonitoringService;
} | null = null;

function getServices() {
  if (!services) {
    const project = new ProjectService(
      new PrismaProjectRepository(),
      getAuthorizationService(),
    );
    services = {
      project,
      analyst: new AnalystService(project),
      site: new SiteService(project),
      monitoring: new MonitoringService(new PrismaMonitoringRepository()),
    };
  }
  return services;
}

export const getProjectService = () => getServices().project;
export const getAnalystService = () => getServices().analyst;
export const getSiteService = () => getServices().site;
export const getMonitoringService = () => getServices().monitoring;

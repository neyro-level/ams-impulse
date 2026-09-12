import type {
  ProjectRepository,
  StoredProjectRecord,
  StoredSiteRecord,
} from "./ports/project-repository.ts";
import type { PrincipalContext } from "../../../platform/authorization/principal.ts";
import type { AuthorizationService } from "../../../platform/authorization/authorization-service.ts";

export interface ProjectSiteSummary {
  siteId: string;
  projectId: string;
  organizationId: string;
  projectSlug: string;
  siteSlug: string;
  name: string;
  url: string;
  timezone: string;
  enabled: boolean;
  enabledSourceCount: number;
  connectionIssueCount: number;
  latestReportAt: string | null;
  reportFreshness: "fresh" | "stale" | "partial" | "unavailable";
}

export interface ProjectTree {
  projectId: string;
  organizationId: string;
  projectSlug: string;
  name: string;
  status: "ACTIVE" | "PLANNED" | "DISABLED";
  sites: ProjectSiteSummary[];
}

export interface ProjectSummary {
  projectId: string;
  organizationId: string;
  projectSlug: string;
  name: string;
  status: "ACTIVE" | "PLANNED" | "DISABLED";
  totalSites: number;
  connectedSites: number;
  readySites: number;
  enabledSources: number;
  issueCount: number;
  latestReportAt: string | null;
  freshness: "fresh" | "stale" | "partial" | "unavailable";
}

function toProjectTree(project: StoredProjectRecord): ProjectTree {
  return {
    projectId: project.projectId,
    organizationId: project.organizationId,
    projectSlug: project.projectSlug,
    name: project.name,
    status: project.status,
    sites: project.sites.map((site) => ({
      siteId: site.siteId,
      projectId: site.projectId,
      organizationId: site.organizationId,
      projectSlug: site.projectSlug,
      siteSlug: site.siteSlug,
      name: site.name,
      url: site.url,
      timezone: site.timezone,
      enabled: site.enabled,
      enabledSourceCount: site.enabledSourceCount,
      connectionIssueCount: site.connectionIssueCount ?? 0,
      latestReportAt: site.latestReportAt ?? null,
      reportFreshness: site.reportFreshness ?? "unavailable",
    })),
  };
}

function toProjectSummary(project: ProjectTree): ProjectSummary {
  const enabledSites = project.sites.filter((site) => site.enabled);
  const latestReportAt = enabledSites
    .map((site) => site.latestReportAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
  const freshness = enabledSites.length === 0 || enabledSites.some((site) => site.reportFreshness === "unavailable")
    ? "unavailable"
    : enabledSites.some((site) => site.reportFreshness === "stale")
      ? "stale"
      : enabledSites.some((site) => site.reportFreshness === "partial")
        ? "partial"
        : "fresh";
  return {
    projectId: project.projectId,
    organizationId: project.organizationId,
    projectSlug: project.projectSlug,
    name: project.name,
    status: project.status,
    totalSites: project.sites.length,
    connectedSites: project.sites.filter((site) => site.enabled).length,
    readySites: project.sites.filter((site) => site.enabled && site.enabledSourceCount >= 2).length,
    enabledSources: project.sites.reduce((count, site) => count + site.enabledSourceCount, 0),
    issueCount: enabledSites.filter((site) =>
      site.enabledSourceCount < 2 ||
      site.connectionIssueCount > 0 ||
      site.reportFreshness !== "fresh",
    ).length + (project.status === "DISABLED" ? 1 : 0),
    latestReportAt,
    freshness,
  };
}

export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly authorization: AuthorizationService,
  ) {}

  private async getAccessScope(principal: PrincipalContext) {
    return {
      projectIds: await this.authorization.listAccessibleProjectIds(principal, "seo-monitor"),
      databaseUserId: principal.kind === "api-client" || principal.kind === "job" ? undefined : principal.userId,
    };
  }

  async listProjectTreesForUser(user: PrincipalContext): Promise<ProjectTree[]> {
    const scope = await this.getAccessScope(user);
    const projects = await this.projectRepository.listProjects(scope);
    return projects.map(toProjectTree);
  }

  async listProjectsForUser(user: PrincipalContext): Promise<ProjectSummary[]> {
    const projects = await this.listProjectTreesForUser(user);
    return projects.map(toProjectSummary);
  }

  async getProjectTreeForUser(
    user: PrincipalContext,
    projectSlug: string,
  ): Promise<ProjectTree | null> {
    const project = await this.getProjectAccessForUser(user, projectSlug);
    return project ? toProjectTree(project) : null;
  }

  async getProjectAccessForUser(
    user: PrincipalContext,
    projectSlug: string,
  ): Promise<StoredProjectRecord | null> {
    const scope = await this.getAccessScope(user);
    return this.projectRepository.findProjectBySlug(projectSlug, scope);
  }

  async getSiteAccessForUser(
    user: PrincipalContext,
    projectSlug: string,
    siteSlug: string,
  ): Promise<StoredSiteRecord | null> {
    const scope = await this.getAccessScope(user);
    return this.projectRepository.findSiteBySlugs(projectSlug, siteSlug, scope);
  }

  async getSiteBySlugs(projectSlug: string, siteSlug: string): Promise<StoredSiteRecord | null> {
    return this.projectRepository.findSiteBySlugs(projectSlug, siteSlug, {
      projectIds: null,
    });
  }
}

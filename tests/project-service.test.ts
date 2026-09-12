import { describe, expect, it } from "vitest";
import { ProjectService } from "../src/modules/project-registry/server.ts";
import type {
  ProjectAccessScope,
  ProjectRepository,
  StoredProjectRecord,
  StoredSiteRecord,
} from "../src/modules/project-registry/index.ts";
import type { ProductProjectGrant } from "../src/platform/authorization/access-types.ts";
import { AuthorizationService } from "../src/platform/authorization/authorization-service.ts";
import {
  createDeniedJobPrincipal,
  createPlatformAdminPrincipal,
  createPlatformAnalystPrincipal,
  createTenantUserPrincipal,
} from "./helpers/principal.ts";

const analystUser = createPlatformAnalystPrincipal("analyst-1");

const alphaViewer = createTenantUserPrincipal({
  userId: "viewer-1",
  membershipId: "membership-alpha",
  organizationId: "org-alpha",
});

const platformAdmin = createPlatformAdminPrincipal();

const deniedPrincipal = createDeniedJobPrincipal("org-alpha");

const projects: StoredProjectRecord[] = [
  {
    projectId: "project-alpha",
    organizationId: "org-alpha",
    projectSlug: "alpha",
    name: "Альфа",
    status: "ACTIVE",
    sites: [
      {
        siteId: "site-north",
        projectId: "project-alpha",
        organizationId: "org-alpha",
        projectSlug: "alpha",
        siteSlug: "north",
        name: "Север",
        url: "https://alpha.example.test",
        timezone: "+03:00",
        enabled: true,
        enabledSourceCount: 2,
        connectionIssueCount: 0,
        latestReportAt: "2026-09-12T08:00:00.000Z",
        reportFreshness: "fresh",
      },
      {
        siteId: "site-east",
        projectId: "project-alpha",
        organizationId: "org-alpha",
        projectSlug: "alpha",
        siteSlug: "east",
        name: "Восток",
        url: "https://east.example.test",
        timezone: "+03:00",
        enabled: true,
        enabledSourceCount: 2,
        connectionIssueCount: 1,
        latestReportAt: "2026-09-11T08:00:00.000Z",
        reportFreshness: "stale",
      },
    ],
  },
  {
    projectId: "project-west",
    organizationId: "org-west",
    projectSlug: "beta",
    name: "Бета",
    status: "PLANNED",
    sites: [
      {
        siteId: "site-west",
        projectId: "project-west",
        organizationId: "org-west",
        projectSlug: "beta",
        siteSlug: "west",
        name: "Запад",
        url: "https://todo.invalid/west",
        timezone: "+03:00",
        enabled: false,
        enabledSourceCount: 0,
      },
    ],
  },
];

class FakeProjectRepository implements ProjectRepository {
  async listProjects(scope: ProjectAccessScope): Promise<StoredProjectRecord[]> {
    return scope.projectIds === null
      ? projects
      : projects.filter((project) => scope.projectIds!.includes(project.projectId));
  }

  async findProjectBySlug(
    projectSlug: string,
    scope: ProjectAccessScope,
  ): Promise<StoredProjectRecord | null> {
    return (
      (await this.listProjects(scope)).find((project) => project.projectSlug === projectSlug) ?? null
    );
  }

  async findSiteBySlugs(
    projectSlug: string,
    siteSlug: string,
    scope: ProjectAccessScope,
  ): Promise<StoredSiteRecord | null> {
    const project = await this.findProjectBySlug(projectSlug, scope);
    return project?.sites.find((site) => site.siteSlug === siteSlug) ?? null;
  }
}

describe("ProjectService", () => {
  const grants: ProductProjectGrant[] = [
    { product: "seo-monitor", organizationId: "org-alpha", projectId: "project-alpha", role: "VIEWER" },
    { product: "seo-monitor", organizationId: "org-alpha", projectId: "project-alpha", role: "ANALYST" },
    { product: "seo-monitor", organizationId: "org-west", projectId: "project-west", role: "ANALYST" },
  ];
  const authorization = new AuthorizationService({
    async listProjectGrants(userId, product) {
      const role = userId === "analyst-1" ? "ANALYST" : userId === "viewer-1" ? "VIEWER" : null;
      return role ? grants.filter((grant) => grant.role === role && (!product || grant.product === product)) : [];
    },
  });
  const projectService = new ProjectService(new FakeProjectRepository(), authorization);

  it("shows every project to analyst", async () => {
    const summaries = await projectService.listProjectsForUser(analystUser);
    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      freshness: "stale",
      issueCount: 1,
      latestReportAt: "2026-09-12T08:00:00.000Z",
    });
  });

  it("allows platform admin through capabilities rather than analyst role equality", async () => {
    expect(await projectService.listProjectsForUser(platformAdmin)).toHaveLength(2);
  });

  it("limits client viewer to an explicitly granted project", async () => {
    const visibleProjects = await projectService.listProjectsForUser(alphaViewer);
    expect(visibleProjects).toHaveLength(1);
    expect(visibleProjects[0]?.projectSlug).toBe("alpha");
  });

  it("denies a principal without project read capability", async () => {
    expect(await projectService.listProjectsForUser(deniedPrincipal)).toEqual([]);
  });

  it("returns site access only inside an explicitly granted project", async () => {
    expect(
      await projectService.getSiteAccessForUser(alphaViewer, "alpha", "north"),
    ).not.toBeNull();
    expect(
      await projectService.getSiteAccessForUser(alphaViewer, "beta", "west"),
    ).toBeNull();
  });

  it("returns no project shell for an unauthorized sibling project", async () => {
    await expect(projectService.getProjectTreeForUser(alphaViewer, "alpha")).resolves.not.toBeNull();
    await expect(projectService.getProjectTreeForUser(alphaViewer, "beta")).resolves.toBeNull();
  });
});

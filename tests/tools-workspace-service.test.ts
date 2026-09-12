import { describe, expect, it } from "vitest";
import { ToolsWorkspaceService, type ToolsWorkspaceRepository } from "../src/modules/tools-workspace/index.ts";
import { AuthorizationService } from "../src/platform/authorization/authorization-service.ts";
import { createPlatformAdminPrincipal, createTenantUserPrincipal } from "./helpers/principal.ts";

const projects = [
  { id: "tools-a", organizationId: "org-a", slug: "research", name: "Исследования", version: 1, archivedAt: null },
  { id: "tools-b", organizationId: "org-b", slug: "contracts", name: "Договоры", version: 1, archivedAt: null },
];

const repository: ToolsWorkspaceRepository = {
  listOrganizations: async () => [{ id: "org-a", slug: "atlas", name: "Атлас", version: 1, archivedAt: null }],
  listProjects: async (ids) => ids === null ? projects : projects.filter((project) => ids.includes(project.id)),
  listProjectOptions: async (ids) => (ids === null ? projects : projects.filter((project) => ids.includes(project.id))).map((project) => ({ ...project, organizationName: project.organizationId, organizationSlug: project.organizationId })),
  createOrganization: async (input) => ({ id: "org-new", ...input, version: 1, archivedAt: null }),
  updateOrganization: async (input) => ({ id: input.organizationId, slug: input.slug, name: input.name, version: input.version + 1, archivedAt: null }),
  createProject: async (input) => ({ id: "project-new", ...input, version: 1, archivedAt: null }),
  updateProject: async (input) => ({ id: input.projectId, organizationId: input.organizationId, slug: input.slug, name: input.name, version: input.version + 1, archivedAt: null }),
  archiveProject: async () => true,
  grantProject: async (input) => ({ accessId: "grant-1", userId: input.userId }),
};

const authorization = new AuthorizationService({
  async listProjectGrants(userId) {
    return userId === "client" ? [{ product: "tools", organizationId: "org-a", projectId: "tools-a", role: "VIEWER" }] : [];
  },
});

describe("ToolsWorkspaceService", () => {
  it("lists only explicitly assigned Tools projects", async () => {
    const service = new ToolsWorkspaceService(repository, authorization);
    const client = createTenantUserPrincipal({ userId: "client", organizationId: "seo-org" });
    await expect(service.listProjects(client)).resolves.toEqual([projects[0]]);
    await expect(
      service.resolveProjectScope(client, { organizationId: "org-a", projectId: "tools-a" }),
    ).resolves.toEqual({ organizationId: "org-a", projectId: "tools-a" });
    await expect(
      service.resolveProjectScope(client, { organizationId: "org-b", projectId: "tools-a" }),
    ).resolves.toBeNull();
    await expect(
      service.resolveProjectScope(client, { organizationId: "org-b", projectId: "tools-b" }),
    ).resolves.toBeNull();
  });

  it("allows only Platform Admin to change workspace structure and grants", async () => {
    const service = new ToolsWorkspaceService(repository, authorization);
    const client = createTenantUserPrincipal({ userId: "client", organizationId: "org-a" });
    await expect(service.createOrganization(client, { slug: "new", name: "Новая" })).rejects.toMatchObject({ code: "TOOLS_ADMIN_ACCESS_DENIED" });
    await expect(service.grantProject(client, { organizationId: "org-a", projectId: "tools-a", userId: "client", role: "VIEWER" })).rejects.toMatchObject({ code: "TOOLS_ADMIN_ACCESS_DENIED" });
    await expect(service.grantProject(createPlatformAdminPrincipal(), { organizationId: "org-a", projectId: "tools-a", userId: "client", role: "VIEWER" })).resolves.toEqual({ accessId: "grant-1", userId: "client" });
  });
});

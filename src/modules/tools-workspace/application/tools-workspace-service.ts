import type { AuthorizationService } from "../../../platform/authorization/authorization-service.ts";
import type { PlatformAdminPrincipal, PrincipalContext } from "../../../platform/authorization/principal.ts";
import {
  archiveToolsProjectSchema,
  createToolsOrganizationSchema,
  createToolsProjectSchema,
  grantToolsProjectSchema,
  ToolsWorkspaceError,
  updateToolsOrganizationSchema,
  updateToolsProjectSchema,
} from "../domain/tools-workspace.ts";
import type { ToolsWorkspaceRepository } from "./ports/tools-workspace-repository.ts";

function requireAdmin(principal: PrincipalContext): asserts principal is PlatformAdminPrincipal {
  if (principal.kind !== "platform-admin") throw new ToolsWorkspaceError("TOOLS_ADMIN_ACCESS_DENIED");
}

export class ToolsWorkspaceService {
  constructor(private readonly repository: ToolsWorkspaceRepository, private readonly authorization: AuthorizationService) {}

  async listOrganizations(principal: PrincipalContext) {
    requireAdmin(principal);
    return this.repository.listOrganizations();
  }

  async listProjects(principal: PrincipalContext) {
    return this.repository.listProjects(await this.authorization.listAccessibleProjectIds(principal, "tools"));
  }

  async listProjectOptions(principal: PrincipalContext) {
    return this.repository.listProjectOptions(await this.authorization.listAccessibleProjectIds(principal, "tools"));
  }

  async resolveProjectScope(
    principal: PrincipalContext,
    requested: { organizationId: string; projectId: string },
  ): Promise<{ organizationId: string; projectId: string } | null> {
    const options = await this.listProjectOptions(principal);
    const option = options.find(
      ({ organizationId, id }) =>
        organizationId === requested.organizationId && id === requested.projectId,
    );
    return option ? { organizationId: option.organizationId, projectId: option.id } : null;
  }

  async createOrganization(principal: PrincipalContext, raw: unknown) { requireAdmin(principal); return this.repository.createOrganization(createToolsOrganizationSchema.parse(raw)); }
  async createProject(principal: PrincipalContext, raw: unknown) { requireAdmin(principal); return this.repository.createProject(createToolsProjectSchema.parse(raw)); }
  async grantProject(principal: PrincipalContext, raw: unknown) {
    requireAdmin(principal);
    return this.repository.grantProject({ ...grantToolsProjectSchema.parse(raw), actorId: principal.userId, correlationId: principal.correlationId });
  }

  async updateOrganization(principal: PrincipalContext, raw: unknown) {
    requireAdmin(principal); const result = await this.repository.updateOrganization(updateToolsOrganizationSchema.parse(raw));
    if (!result) throw new ToolsWorkspaceError("TOOLS_RECORD_STALE"); return result;
  }

  async updateProject(principal: PrincipalContext, raw: unknown) {
    requireAdmin(principal); const result = await this.repository.updateProject(updateToolsProjectSchema.parse(raw));
    if (!result) throw new ToolsWorkspaceError("TOOLS_RECORD_STALE"); return result;
  }

  async archiveProject(principal: PrincipalContext, raw: unknown) {
    requireAdmin(principal); if (!await this.repository.archiveProject(archiveToolsProjectSchema.parse(raw))) throw new ToolsWorkspaceError("TOOLS_RECORD_STALE");
  }
}

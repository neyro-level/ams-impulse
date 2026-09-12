import { Prisma, type PrismaClient } from "../../../generated/prisma/client.ts";
import { newId } from "../../../platform/identifiers/new-id.ts";
import { getPrismaClient } from "../../../platform/database/prisma/client.ts";
import { setDatabaseAuthorizationContext } from "../../../platform/database/authorization-context.ts";
import type { DatabaseTransaction } from "../../../platform/database/transaction.ts";
import { ToolsWorkspaceError, type ArchiveToolsProjectInput, type CreateToolsOrganizationInput, type CreateToolsProjectInput, type GrantToolsProjectInput, type ToolsOrganizationRecord, type ToolsProjectOption, type ToolsProjectRecord, type UpdateToolsOrganizationInput, type UpdateToolsProjectInput } from "../domain/tools-workspace.ts";
import type { ToolsWorkspaceRepository } from "../application/ports/tools-workspace-repository.ts";

type OrganizationRow = Omit<ToolsOrganizationRecord, "archivedAt"> & { archivedAt: Date | null };
type ProjectRow = Omit<ToolsProjectRecord, "archivedAt"> & { archivedAt: Date | null };
const mapOrganization = (row: OrganizationRow): ToolsOrganizationRecord => ({ ...row, archivedAt: row.archivedAt?.toISOString() ?? null });
const mapProject = (row: ProjectRow): ToolsProjectRecord => ({ ...row, archivedAt: row.archivedAt?.toISOString() ?? null });

export class PrismaToolsWorkspaceRepository implements ToolsWorkspaceRepository {
  constructor(private readonly databaseUserId: string, private readonly injectedPrisma?: PrismaClient) {}
  private get prisma() { return this.injectedPrisma ?? getPrismaClient(); }
  private withContext<T>(operation: (transaction: DatabaseTransaction) => Promise<T>) {
    return this.prisma.$transaction(async (transaction) => {
      await setDatabaseAuthorizationContext(transaction, { kind: "user", userId: this.databaseUserId });
      return operation(transaction);
    });
  }

  async listOrganizations() {
    const rows = await this.withContext((transaction) => transaction.$queryRaw<OrganizationRow[]>(Prisma.sql`SELECT "id", "slug", "name", "version", "archivedAt" FROM "tools"."ToolsOrganization" ORDER BY "name"`));
    return rows.map(mapOrganization);
  }
  async listProjects(projectIds: string[] | null) {
    if (projectIds !== null && projectIds.length === 0) return [];
    const rows = await this.withContext((transaction) => projectIds === null
      ? transaction.$queryRaw<ProjectRow[]>(Prisma.sql`SELECT "id", "organizationId", "slug", "name", "version", "archivedAt" FROM "tools"."ToolsProject" WHERE "archivedAt" IS NULL ORDER BY "name"`)
      : transaction.$queryRaw<ProjectRow[]>(Prisma.sql`SELECT "id", "organizationId", "slug", "name", "version", "archivedAt" FROM "tools"."ToolsProject" WHERE "id" IN (${Prisma.join(projectIds)}) AND "archivedAt" IS NULL ORDER BY "name"`));
    return rows.map(mapProject);
  }
  async listProjectOptions(projectIds: string[] | null) {
    if (projectIds !== null && projectIds.length === 0) return [];
    return this.withContext((transaction) => transaction.$queryRaw<ToolsProjectOption[]>(projectIds === null ? Prisma.sql`
      SELECT project."id", project."organizationId", project."slug", project."name", project."version", project."archivedAt",
        organization."name" AS "organizationName", organization."slug" AS "organizationSlug"
      FROM "tools"."ToolsProject" AS project
      JOIN "tools"."ToolsOrganization" AS organization ON organization.id=project."organizationId"
      WHERE project."archivedAt" IS NULL AND organization."archivedAt" IS NULL
      ORDER BY organization."name", project."name"
    ` : Prisma.sql`
      SELECT project."id", project."organizationId", project."slug", project."name", project."version", project."archivedAt",
        organization."name" AS "organizationName", organization."slug" AS "organizationSlug"
      FROM "tools"."ToolsProject" AS project
      JOIN "tools"."ToolsOrganization" AS organization ON organization.id=project."organizationId"
      WHERE project."id" IN (${Prisma.join(projectIds)}) AND project."archivedAt" IS NULL AND organization."archivedAt" IS NULL
      ORDER BY organization."name", project."name"
    `));
  }
  async createOrganization(input: CreateToolsOrganizationInput) {
    const id = newId();
    const rows = await this.withContext((transaction) => transaction.$queryRaw<OrganizationRow[]>(Prisma.sql`INSERT INTO "tools"."ToolsOrganization" ("id", "slug", "name") VALUES (${id}, ${input.slug}, ${input.name}) RETURNING "id", "slug", "name", "version", "archivedAt"`));
    return mapOrganization(rows[0]!);
  }
  async updateOrganization(input: UpdateToolsOrganizationInput) {
    const rows = await this.withContext((transaction) => transaction.$queryRaw<OrganizationRow[]>(Prisma.sql`UPDATE "tools"."ToolsOrganization" SET "slug"=${input.slug}, "name"=${input.name}, "version"="version"+1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${input.organizationId} AND "version"=${input.version} AND "archivedAt" IS NULL RETURNING "id", "slug", "name", "version", "archivedAt"`));
    return rows[0] ? mapOrganization(rows[0]) : null;
  }
  async createProject(input: CreateToolsProjectInput) {
    const id = newId();
    const rows = await this.withContext((transaction) => transaction.$queryRaw<ProjectRow[]>(Prisma.sql`INSERT INTO "tools"."ToolsProject" ("id", "organizationId", "slug", "name") VALUES (${id}, ${input.organizationId}, ${input.slug}, ${input.name}) RETURNING "id", "organizationId", "slug", "name", "version", "archivedAt"`));
    return mapProject(rows[0]!);
  }
  async updateProject(input: UpdateToolsProjectInput) {
    const rows = await this.withContext((transaction) => transaction.$queryRaw<ProjectRow[]>(Prisma.sql`UPDATE "tools"."ToolsProject" SET "slug"=${input.slug}, "name"=${input.name}, "version"="version"+1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${input.projectId} AND "organizationId"=${input.organizationId} AND "version"=${input.version} AND "archivedAt" IS NULL RETURNING "id", "organizationId", "slug", "name", "version", "archivedAt"`));
    return rows[0] ? mapProject(rows[0]) : null;
  }
  async archiveProject(input: ArchiveToolsProjectInput) {
    return this.withContext(async (transaction) => (await transaction.$executeRaw(Prisma.sql`UPDATE "tools"."ToolsProject" SET "archivedAt"=CURRENT_TIMESTAMP, "version"="version"+1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${input.projectId} AND "organizationId"=${input.organizationId} AND "version"=${input.version} AND "archivedAt" IS NULL`)) === 1);
  }
  async grantProject(input: GrantToolsProjectInput & { actorId: string; correlationId: string }) {
    const membershipId = newId(); const accessId = newId();
    try {
      const effectiveAccessId = await this.withContext(async (transaction) => {
        await transaction.$executeRaw(Prisma.sql`INSERT INTO "tools"."ToolsMembership" ("id", "organizationId", "userId") VALUES (${membershipId}, ${input.organizationId}, ${input.userId}) ON CONFLICT ("organizationId", "userId") DO NOTHING`);
        const memberships = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "tools"."ToolsMembership" WHERE "organizationId"=${input.organizationId} AND "userId"=${input.userId}`);
        const membership = memberships[0]; if (!membership) throw new ToolsWorkspaceError("TOOLS_REFERENCE_INVALID");
        const accesses = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`INSERT INTO "tools"."ToolsProjectAccess" ("id", "membershipId", "organizationId", "projectId", "role") VALUES (${accessId}, ${membership.id}, ${input.organizationId}, ${input.projectId}, ${input.role}::"tools"."ProductRole") ON CONFLICT ("membershipId", "projectId") DO UPDATE SET "role"=EXCLUDED."role", "version"="ToolsProjectAccess"."version"+1, "updatedAt"=CURRENT_TIMESTAMP RETURNING "id"`);
        const effectiveAccess = accesses[0]; if (!effectiveAccess) throw new ToolsWorkspaceError("TOOLS_REFERENCE_INVALID");
        await transaction.session.deleteMany({ where: { userId: input.userId } });
        await transaction.$executeRaw(Prisma.sql`INSERT INTO "public"."AuditEvent" ("id", "organizationId", "actorType", "actorId", "action", "entityType", "entityId", "beforeMarker", "afterMarker", "source", "correlationId", "createdAt") VALUES (${newId()}, NULL, 'USER', ${input.actorId}, 'tools-project-access.upsert', 'ToolsProjectAccess', ${effectiveAccess.id}, NULL, ${JSON.stringify({ toolsOrganizationId: input.organizationId, toolsProjectId: input.projectId, userId: input.userId, role: input.role })}::jsonb, 'tools-workspace', ${input.correlationId}, CURRENT_TIMESTAMP)`);
        return effectiveAccess.id;
      });
      return { accessId: effectiveAccessId, userId: input.userId };
    } catch (error) {
      if (error instanceof ToolsWorkspaceError) throw error;
      throw new ToolsWorkspaceError("TOOLS_REFERENCE_INVALID");
    }
  }
}

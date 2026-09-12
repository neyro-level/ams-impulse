import { Prisma } from "../../../generated/prisma/client.ts";
import type { DatabaseTransaction } from "../../../platform/database/transaction.ts";
import type {
  ProjectAuditInput,
  ProjectReferenceRepository,
} from "../application/ports/project-reference-repository.ts";
import type {
  CreateProjectInput,
  ProjectStatus,
  UpdateProjectSettingsInput,
} from "../domain/project.ts";
import { ProjectError } from "../domain/project.ts";

function translateWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") throw new ProjectError("PROJECT_SLUG_CONFLICT");
    if (error.code === "P2003") throw new ProjectError("PROJECT_REFERENCE_INVALID");
  }
  throw error;
}

export class PrismaProjectReferenceRepository implements ProjectReferenceRepository {
  constructor(
    private readonly transaction: DatabaseTransaction,
    private readonly organizationId: string,
  ) {
    if (!organizationId.trim()) throw new Error("TENANT_SCOPE_REQUIRED");
  }

  async findForAction(projectId: string) {
    return this.transaction.project.findFirst({
      where: { id: projectId, organizationId: this.organizationId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        slug: true,
        status: true,
        thresholdProfileId: true,
        clusterProfileId: true,
        version: true,
      },
    });
  }

  async create(input: CreateProjectInput) {
    try {
      return await this.transaction.project.create({
        data: {
          organizationId: this.organizationId,
          slug: input.slug,
          name: input.name,
          status: input.status,
          thresholdProfileId: input.thresholdProfileId,
          clusterProfileId: input.clusterProfileId,
        },
        select: { id: true, version: true },
      });
    } catch (error) {
      translateWriteError(error);
    }
  }

  async updateStatus(input: {
    projectId: string;
    expectedVersion: number;
    status: ProjectStatus;
  }): Promise<boolean> {
    const result = await this.transaction.project.updateMany({
      where: {
        id: input.projectId,
        organizationId: this.organizationId,
        version: input.expectedVersion,
      },
      data: { status: input.status, version: { increment: 1 } },
    });
    return result.count === 1;
  }

  async updateSettings(
    input: Pick<
      UpdateProjectSettingsInput,
      "projectId" | "version" | "name" | "thresholdProfileId" | "clusterProfileId"
    >,
  ): Promise<boolean> {
    try {
      const result = await this.transaction.project.updateMany({
        where: {
          id: input.projectId,
          organizationId: this.organizationId,
          version: input.version,
        },
        data: {
          name: input.name,
          thresholdProfileId: input.thresholdProfileId,
          clusterProfileId: input.clusterProfileId,
          version: { increment: 1 },
        },
      });
      return result.count === 1;
    } catch (error) {
      translateWriteError(error);
    }
  }

  async appendAudit(input: ProjectAuditInput): Promise<void> {
    await this.transaction.auditEvent.create({
      data: {
        organizationId: this.organizationId,
        actorType: "USER",
        actorId: input.actorId,
        action: input.action,
        entityType: "Project",
        entityId: input.projectId,
        beforeMarker: input.beforeMarker ?? Prisma.JsonNull,
        afterMarker: input.afterMarker,
        source: "project-registry",
        correlationId: input.correlationId,
      },
    });
  }
}

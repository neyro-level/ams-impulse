
import type {
  ProjectAccessScope,
  ProjectRepository,
  StoredProjectRecord,
  StoredSiteRecord,
} from "../application/ports/project-repository.ts";
import { getPrismaClient } from "../../../platform/database/prisma/client.ts";
import { setDatabaseAuthorizationContext } from "../../../platform/database/authorization-context.ts";
import type { DatabaseTransaction } from "../../../platform/database/transaction.ts";

type Store = ReturnType<typeof getPrismaClient> | DatabaseTransaction;

function mapSiteRecord(site: {
  id: string;
  slug: string;
  name: string;
  url: string;
  timezone: string;
  enabled: boolean;
  projectId: string;
  project: { slug: string; organizationId: string };
  providerConnections: Array<{ enabled: boolean }>;
}): StoredSiteRecord {
  return {
    siteId: site.id,
    projectId: site.projectId,
    organizationId: site.project.organizationId,
    projectSlug: site.project.slug,
    siteSlug: site.slug,
    name: site.name,
    url: site.url,
    timezone: site.timezone,
    enabled: site.enabled,
    enabledSourceCount: site.providerConnections.filter((connection) => connection.enabled).length,
  };
}

function mapProjectRecord(project: {
  id: string;
  slug: string;
  name: string;
  status: "ACTIVE" | "PLANNED" | "DISABLED";
  organizationId: string;
  sites: Array<{
    id: string;
    slug: string;
    name: string;
    url: string;
    timezone: string;
    enabled: boolean;
    projectId: string;
    project: { slug: string; organizationId: string };
    providerConnections: Array<{ enabled: boolean }>;
  }>;
}): StoredProjectRecord {
  return {
    projectId: project.id,
    organizationId: project.organizationId,
    projectSlug: project.slug,
    name: project.name,
    status: project.status,
    sites: project.sites.map(mapSiteRecord),
  };
}

export class PrismaProjectRepository implements ProjectRepository {
  private withScope<T>(scope: ProjectAccessScope, operation: (store: Store) => Promise<T>) {
    const prisma = getPrismaClient();
    if (!scope.databaseUserId) return operation(prisma);
    return prisma.$transaction(async (transaction) => {
      await setDatabaseAuthorizationContext(transaction, { kind: "user", userId: scope.databaseUserId! });
      return operation(transaction);
    });
  }

  async listProjects(scope: ProjectAccessScope): Promise<StoredProjectRecord[]> {
    const projects = await this.withScope(scope, (store) => store.project.findMany({
      where:
        scope.projectIds === null
          ? undefined
          : { id: { in: scope.projectIds } },
      orderBy: { slug: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        organizationId: true,
        sites: {
          orderBy: { slug: "asc" },
          select: {
            id: true,
            slug: true,
            name: true,
            url: true,
            timezone: true,
            enabled: true,
            projectId: true,
            project: {
              select: {
                slug: true,
                organizationId: true,
              },
            },
            providerConnections: {
              select: {
                enabled: true,
              },
            },
          },
        },
      },
    }));

    return projects.map(mapProjectRecord);
  }

  async findProjectBySlug(
    projectSlug: string,
    scope: ProjectAccessScope,
  ): Promise<StoredProjectRecord | null> {
    const project = await this.withScope(scope, (store) => store.project.findFirst({
      where: {
        slug: projectSlug,
        ...(scope.projectIds === null
          ? {}
          : { id: { in: scope.projectIds } }),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        organizationId: true,
        sites: {
          orderBy: { slug: "asc" },
          select: {
            id: true,
            slug: true,
            name: true,
            url: true,
            timezone: true,
            enabled: true,
            projectId: true,
            project: {
              select: {
                slug: true,
                organizationId: true,
              },
            },
            providerConnections: {
              select: {
                enabled: true,
              },
            },
          },
        },
      },
    }));

    return project ? mapProjectRecord(project) : null;
  }

  async findSiteBySlugs(
    projectSlug: string,
    siteSlug: string,
    scope: ProjectAccessScope,
  ): Promise<StoredSiteRecord | null> {
    const site = await this.withScope(scope, (store) => store.site.findFirst({
      where: {
        slug: siteSlug,
        project: {
          slug: projectSlug,
          ...(scope.projectIds === null
            ? {}
            : { id: { in: scope.projectIds } }),
        },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        url: true,
        timezone: true,
        enabled: true,
        projectId: true,
        project: {
          select: {
            slug: true,
            organizationId: true,
          },
        },
        providerConnections: {
          select: {
            enabled: true,
          },
        },
      },
    }));

    return site ? mapSiteRecord(site) : null;
  }

}

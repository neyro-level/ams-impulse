import { Prisma, type PrismaClient } from "../../../generated/prisma/client.ts";
import type { ProductCode, ProductProjectGrant, ProductRole } from "../../../platform/authorization/access-types.ts";
import type { AccessGrantRepository } from "../../../platform/authorization/authorization-service.ts";
import { getPrismaClient } from "../../../platform/database/prisma/client.ts";
import { setDatabaseAuthorizationContext } from "../../../platform/database/authorization-context.ts";
import { cache } from "react";

async function loadProjectGrants(
  prisma: PrismaClient,
  userId: string,
  product?: ProductCode,
): Promise<ProductProjectGrant[]> {
  return prisma.$transaction(async (transaction) => {
    await setDatabaseAuthorizationContext(transaction, { kind: "user", userId });
    const seoGrants = product && product !== "seo-monitor" ? [] : await transaction.seoProjectAccess.findMany({
      where: { membership: { userId, user: { disabledAt: null } } },
      orderBy: [{ organizationId: "asc" }, { projectId: "asc" }],
      select: { organizationId: true, projectId: true, role: true },
    });
    const toolsGrants = product && product !== "tools" ? [] : await transaction.$queryRaw<Array<{ organizationId: string; projectId: string; role: ProductRole }>>(Prisma.sql`
      SELECT access."organizationId", access."projectId", access."role"::text AS "role"
      FROM "tools"."ToolsProjectAccess" AS access
      JOIN "tools"."ToolsMembership" AS membership
        ON membership.id = access."membershipId" AND membership."organizationId" = access."organizationId"
      JOIN "public"."User" AS app_user ON app_user.id = membership."userId"
      WHERE membership."userId" = ${userId} AND app_user."disabledAt" IS NULL
      ORDER BY access."organizationId", access."projectId"
    `);
    return [
      ...seoGrants.map((grant) => ({ product: "seo-monitor" as const, organizationId: grant.organizationId, projectId: grant.projectId, role: grant.role })),
      ...toolsGrants.map((grant) => ({ product: "tools" as const, ...grant })),
    ];
  });
}

const loadProjectGrantsForRequest = cache(loadProjectGrants);

export class PrismaAccessGrantRepository implements AccessGrantRepository {
  constructor(private readonly injectedPrisma?: PrismaClient) {}

  private get prisma(): PrismaClient {
    return this.injectedPrisma ?? getPrismaClient();
  }

  async listProjectGrants(userId: string, product?: ProductCode): Promise<ProductProjectGrant[]> {
    return loadProjectGrantsForRequest(this.prisma, userId, product);
  }
}

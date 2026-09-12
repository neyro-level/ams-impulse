import { createCorrelationId } from "../http/correlation.ts";
import { getPrismaClient } from "../database/prisma/client.ts";
import type {
  PlatformAdminPrincipal,
  PlatformAnalystPrincipal,
  IdentityUserPrincipal,
  PrincipalContext,
  TenantUserPrincipal,
} from "./principal.ts";

export interface PrincipalFactoryOptions {
  correlationId?: string;
}

export interface PrincipalState {
  principal: PrincipalContext;
  displayName: string;
}

export async function getPrincipalStateByUserId(
  userId: string,
  options: PrincipalFactoryOptions = {},
): Promise<PrincipalState | null> {
  const user = await getPrismaClient().user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      systemRole: true,
      disabledAt: true,
      twoFactorEnabled: true,
    },
  });
  if (!user || user.disabledAt) return null;

  const correlationId = options.correlationId ?? createCorrelationId();
  let principal: PrincipalContext;
  if (user.systemRole === "PLATFORM_ADMIN") {
    if (!user.twoFactorEnabled) return null;
    principal = {
      kind: "platform-admin",
      userId: user.id,
      correlationId,
    } satisfies PlatformAdminPrincipal;
  } else {
    principal = {
      kind: "identity-user",
      userId: user.id,
      systemRole: user.systemRole,
      correlationId,
    } satisfies IdentityUserPrincipal;
  }

  return {
    principal,
    displayName: user.name,
  };
}

export async function getIdentityPrincipalByUserId(
  userId: string,
  options: PrincipalFactoryOptions = {},
): Promise<PlatformAdminPrincipal | IdentityUserPrincipal | null> {
  const user = await getPrismaClient().user.findUnique({
    where: { id: userId },
    select: { id: true, systemRole: true, disabledAt: true, twoFactorEnabled: true },
  });
  if (!user || user.disabledAt) return null;
  const correlationId = options.correlationId ?? createCorrelationId();
  if (user.systemRole === "PLATFORM_ADMIN") {
    if (!user.twoFactorEnabled) return null;
    return { kind: "platform-admin", userId: user.id, correlationId };
  }
  return {
    kind: "identity-user",
    userId: user.id,
    systemRole: user.systemRole,
    correlationId,
  } satisfies IdentityUserPrincipal;
}

export function createJobPrincipal(input: {
  jobName: string;
  organizationId: string;
  projectId?: string;
  correlationId?: string;
}): PrincipalContext {
  return {
    kind: "job",
    jobName: input.jobName,
    organizationId: input.organizationId,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    correlationId: input.correlationId ?? createCorrelationId(),
  };
}

export function requirePlatformAdmin(principal: PrincipalContext): PlatformAdminPrincipal {
  if (principal.kind !== "platform-admin") {
    throw new Error("PLATFORM_ADMIN_REQUIRED");
  }
  return principal;
}

export function requirePlatformAnalyst(principal: PrincipalContext): PlatformAnalystPrincipal {
  if (principal.kind !== "platform-analyst") {
    throw new Error("PLATFORM_ANALYST_REQUIRED");
  }
  return principal;
}

export function requireTenantUser(principal: PrincipalContext): TenantUserPrincipal {
  if (principal.kind !== "tenant-user") {
    throw new Error("TENANT_USER_REQUIRED");
  }
  return principal;
}

import { Prisma } from "../../generated/prisma/client.ts";
import type { PrincipalContext } from "../authorization/principal.ts";
import type { DatabaseTransaction } from "./transaction-types.ts";

export type DatabaseAuthorizationContext =
  | { kind: "user"; userId: string }
  | { kind: "platform-admin"; userId: string }
  | { kind: "api-client"; apiClientId: string; organizationId: string }
  | { kind: "job"; jobName: string; organizationId: string; projectId: string };

export interface DatabaseJobContext {
  organizationId: string;
  projectId: string;
}

function requireContextValue(value: string | undefined): string {
  if (!value?.trim()) throw new Error("AUTHORIZATION_CONTEXT_REQUIRED");
  return value;
}

export function deriveDatabaseAuthorizationContext(
  principal: PrincipalContext,
): DatabaseAuthorizationContext {
  switch (principal.kind) {
    case "platform-admin":
      return { kind: "platform-admin", userId: requireContextValue(principal.userId) };
    case "platform-analyst":
    case "identity-user":
    case "tenant-user":
      return { kind: "user", userId: requireContextValue(principal.userId) };
    case "api-client":
      return {
        kind: "api-client",
        apiClientId: requireContextValue(principal.apiClientId),
        organizationId: requireContextValue(principal.organizationId),
      };
    case "job":
      return {
        kind: "job",
        jobName: requireContextValue(principal.jobName),
        organizationId: requireContextValue(principal.organizationId),
        projectId: requireContextValue(principal.projectId),
      };
  }
}

export async function setDatabaseAuthorizationContext(
  transaction: DatabaseTransaction,
  context: DatabaseAuthorizationContext,
): Promise<void> {
  const userId = context.kind === "user" || context.kind === "platform-admin" ? context.userId : "";
  const jobName = context.kind === "job" ? context.jobName : "";
  const jobOrganizationId = context.kind === "job" ? context.organizationId : "";
  const jobProjectId = context.kind === "job" ? context.projectId : "";
  const apiClientId = context.kind === "api-client" ? context.apiClientId : "";
  const apiOrganizationId = context.kind === "api-client" ? context.organizationId : "";
  await transaction.$executeRaw(
    Prisma.sql`SELECT
      set_config('ams.principal_kind', ${context.kind}, true),
      set_config('ams.user_id', ${userId}, true),
      set_config('ams.job_name', ${jobName}, true),
      set_config('ams.job_organization_id', ${jobOrganizationId}, true),
      set_config('ams.job_project_id', ${jobProjectId}, true),
      set_config('ams.api_client_id', ${apiClientId}, true),
      set_config('ams.api_organization_id', ${apiOrganizationId}, true)`,
  );
}

export async function setDatabaseJobContext(
  transaction: DatabaseTransaction,
  context: DatabaseJobContext,
): Promise<void> {
  if (!context.organizationId.trim() || !context.projectId.trim()) {
    throw new Error("DATABASE_JOB_CONTEXT_REQUIRED");
  }
  await setDatabaseAuthorizationContext(transaction, {
    kind: "job",
    jobName: "worker",
    organizationId: context.organizationId,
    projectId: context.projectId,
  });
}

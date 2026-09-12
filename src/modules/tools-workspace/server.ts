import "server-only";

import { PrismaAccessGrantRepository } from "../identity-access/server.ts";
import { AuthorizationService } from "../../platform/authorization/authorization-service.ts";
import { getPrismaClient } from "../../platform/database/prisma/client.ts";
import { ToolsWorkspaceService } from "./application/tools-workspace-service.ts";
import { PrismaToolsWorkspaceRepository } from "./infrastructure/prisma-tools-workspace-repository.ts";

export { ToolsWorkspaceService } from "./application/tools-workspace-service.ts";
export { PrismaToolsWorkspaceRepository } from "./infrastructure/prisma-tools-workspace-repository.ts";

export function createToolsWorkspaceService(databaseUserId: string) {
  const prisma = getPrismaClient();
  return new ToolsWorkspaceService(
    new PrismaToolsWorkspaceRepository(databaseUserId, prisma),
    new AuthorizationService(new PrismaAccessGrantRepository(prisma)),
  );
}

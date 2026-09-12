import "server-only";

import { PrismaAccessGrantRepository } from "../identity-access/server.ts";
import { AuthorizationService } from "../../platform/authorization/authorization-service.ts";
import type { PrincipalContext } from "../../platform/authorization/principal.ts";
import { getPrismaClient } from "../../platform/database/prisma/client.ts";
import { ConfiguredResearchBudgetPolicy, ConfiguredResearchPricing } from "./infrastructure/configured-research-pricing.ts";
import { PrismaResearchReportRepository } from "./infrastructure/prisma-research-report-repository.ts";
import { PrismaResearchRepository } from "./infrastructure/prisma-research-repository.ts";
import { S3PrivateExportStorage } from "./infrastructure/s3-private-export-storage.ts";
import { ResearchReportService } from "./application/research-report-service.ts";
import { ResearchService } from "./application/research-service.ts";

export { ResearchService } from "./application/research-service.ts";
export { ResearchReportService } from "./application/research-report-service.ts";
export { PrismaResearchRepository } from "./infrastructure/prisma-research-repository.ts";
export { PrismaResearchReportRepository } from "./infrastructure/prisma-research-report-repository.ts";
export { S3PrivateExportStorage } from "./infrastructure/s3-private-export-storage.ts";
export { ConfiguredResearchBudgetPolicy, ConfiguredResearchPricing } from "./infrastructure/configured-research-pricing.ts";
export { createResearchMcpServer } from "./mcp/research-mcp-server.ts";

function databaseUserId(principal: PrincipalContext) {
  if (principal.kind === "api-client" || principal.kind === "job") throw new Error("USER_PRINCIPAL_REQUIRED");
  return principal.userId;
}

export function createResearchMcpServices(principal: PrincipalContext) {
  const prisma = getPrismaClient();
  const userId = databaseUserId(principal);
  const authorization = new AuthorizationService(new PrismaAccessGrantRepository(prisma));
  const storage = S3PrivateExportStorage.fromEnvironment();
  return {
    research: new ResearchService(
      new PrismaResearchRepository(userId, prisma),
      authorization,
      ConfiguredResearchPricing.fromEnvironment(),
      ConfiguredResearchBudgetPolicy.fromEnvironment(),
    ),
    reports: new ResearchReportService(
      new PrismaResearchReportRepository(userId, prisma),
      authorization,
      storage,
    ),
  };
}

export function createResearchCabinetService(principal: PrincipalContext) {
  const prisma = getPrismaClient();
  const userId = databaseUserId(principal);
  return new ResearchService(
    new PrismaResearchRepository(userId, prisma),
    new AuthorizationService(new PrismaAccessGrantRepository(prisma)),
    ConfiguredResearchPricing.fromEnvironment(),
    ConfiguredResearchBudgetPolicy.fromEnvironment(),
  );
}

export function createResearchReportService(principal: PrincipalContext) {
  const prisma = getPrismaClient();
  const userId = databaseUserId(principal);
  return new ResearchReportService(
    new PrismaResearchReportRepository(userId, prisma),
    new AuthorizationService(new PrismaAccessGrantRepository(prisma)),
    S3PrivateExportStorage.fromEnvironment(),
  );
}

import { AuthorizationService } from "../../platform/authorization/authorization-service.ts";
import { PrismaAccessGrantRepository } from "./infrastructure/prisma-access-grant-repository.ts";

let authorizationService: AuthorizationService | null = null;

export function getWorkerAuthorizationService() {
  authorizationService ??= new AuthorizationService(new PrismaAccessGrantRepository());
  return authorizationService;
}

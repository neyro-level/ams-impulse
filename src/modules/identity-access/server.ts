import "server-only";

export { auth, hasAuthConfiguration } from "../../platform/auth/auth.ts";
export {
  getCurrentCabinetRedirect,
  getCurrentPrincipalState,
  requireCurrentCabinetPrincipal,
} from "../../platform/auth/principal-session.ts";
export {
  createJobPrincipal,
  getIdentityPrincipalByUserId,
  getPrincipalStateByUserId,
  requirePlatformAdmin,
  requirePlatformAnalyst,
  requireTenantUser,
} from "../../platform/authorization/principal-factories.ts";
export { PrismaIdentityAdminRepository } from "./infrastructure/prisma-identity-admin-repository.ts";
export { PrismaAccessGrantRepository } from "./infrastructure/prisma-access-grant-repository.ts";
import { AuthorizationService } from "../../platform/authorization/authorization-service.ts";
import { PrismaAccessGrantRepository } from "./infrastructure/prisma-access-grant-repository.ts";

let authorizationService: AuthorizationService | null = null;

export function getAuthorizationService() {
  authorizationService ??= new AuthorizationService(new PrismaAccessGrantRepository());
  return authorizationService;
}
export {
  createMembership,
  createSeoProjectAccess,
  createOrganization,
  getIdentityAdminFormOptions,
  listMemberships,
  listSeoProjectAccesses,
  listOrganizations,
  listUsers,
  provisionClient,
  resetUserPassword,
  setUserEnabled,
  removeMembership,
  removeSeoProjectAccess,
  updateMembership,
  updateSeoProjectAccess,
  updateOrganization,
} from "./infrastructure/identity-admin-runtime.ts";

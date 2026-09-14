import { describe, expect, it } from "vitest";
import { requireCabinetPrincipalFromState } from "../src/platform/auth/principal-session.ts";
import {
  getPrincipalPermissions,
  hasPermission,
  isTenantPrincipal,
  type PlatformAdminPrincipal,
  type PlatformAnalystPrincipal,
  type PrincipalContext,
  type TenantUserPrincipal,
} from "../src/platform/authorization/principal.ts";
import {
  createJobPrincipal,
  requirePlatformAdmin,
  requirePlatformAnalyst,
  requireTenantUser,
} from "../src/platform/authorization/principal-factories.ts";
import { parseSystemRole } from "../src/modules/identity-access/index.ts";

const correlationId = "00000000-0000-4000-8000-000000000070";
const admin: PlatformAdminPrincipal = {
  kind: "platform-admin",
  userId: "admin-1",
  correlationId,
};
const analyst: PlatformAnalystPrincipal = {
  kind: "platform-analyst",
  userId: "analyst-1",
  correlationId,
};
const viewer: TenantUserPrincipal = {
  kind: "tenant-user",
  userId: "viewer-1",
  organizationId: "organization-a",
  membershipId: "membership-a",
  role: "VIEWER",
  correlationId,
};
const identityAnalyst: PrincipalContext = {
  kind: "identity-user",
  userId: "identity-analyst-1",
  systemRole: "ANALYST",
  correlationId,
};
const apiClient: PrincipalContext = {
  kind: "api-client",
  apiClientId: "api-client-1",
  organizationId: "organization-a",
  correlationId,
};
const job: PrincipalContext = {
  kind: "job",
  jobName: "project-sync",
  organizationId: "organization-a",
  projectId: "project-a",
  correlationId,
};

describe("PrincipalContext", () => {
  it("separates platform principals from tenant principals", () => {
    expect(admin).not.toHaveProperty("organizationId");
    expect(analyst).not.toHaveProperty("organizationId");
    expect(isTenantPrincipal(viewer)).toBe(true);
    expect(isTenantPrincipal(admin)).toBe(false);
  });

  it("keeps platform analyst read-only and tenant viewer organization-scoped", () => {
    expect(hasPermission(admin, "platform:manage")).toBe(true);
    expect(hasPermission(analyst, "platform:manage")).toBe(false);
    expect(hasPermission(analyst, "project:read:any")).toBe(true);
    expect(hasPermission(viewer, "project:read:organization")).toBe(true);
    expect(hasPermission(viewer, "project:read:any")).toBe(false);
    expect(getPrincipalPermissions(viewer)).toEqual([
      "project:read:organization",
      "report:read:organization",
    ]);
  });

  it("keeps global permissions restricted to explicit platform principals", () => {
    const expectedByKind = new Map<PrincipalContext["kind"], readonly string[]>([
      ["platform-admin", getPrincipalPermissions(admin)],
      ["platform-analyst", ["project:read:any", "report:read:any", "sync:read:any", "sync:run:any"]],
      ["identity-user", ["project:read:organization", "report:read:organization"]],
      ["tenant-user", ["project:read:organization", "report:read:organization"]],
      ["api-client", []],
      ["job", []],
    ]);
    const principals = [admin, analyst, identityAnalyst, viewer, apiClient, job];

    for (const principal of principals) {
      expect(getPrincipalPermissions(principal)).toEqual(expectedByKind.get(principal.kind));
    }
    expect(hasPermission(identityAnalyst, "project:read:any")).toBe(false);
    expect(hasPermission(identityAnalyst, "sync:run:any")).toBe(false);
  });

  it("requires the exact principal type at privileged boundaries", () => {
    expect(requirePlatformAdmin(admin)).toBe(admin);
    expect(requirePlatformAnalyst(analyst)).toBe(analyst);
    expect(requireTenantUser(viewer)).toBe(viewer);
    expect(() => requirePlatformAdmin(viewer)).toThrow("PLATFORM_ADMIN_REQUIRED");
    expect(() => requireTenantUser(admin)).toThrow("TENANT_USER_REQUIRED");
  });

  it("creates job principal with an explicit tenant", () => {
    expect(
      createJobPrincipal({
        jobName: "project-sync",
        organizationId: "organization-a",
        projectId: "project-a",
        correlationId,
      }),
    ).toEqual({
      kind: "job",
      jobName: "project-sync",
      organizationId: "organization-a",
      projectId: "project-a",
      correlationId,
    });
  });

  it("opens the cabinet immediately for an active authenticated principal", () => {
    expect(
      requireCabinetPrincipalFromState(
        { principal: admin, displayName: "Admin" },
      ),
    ).toBe(admin);
  });

  it("validates operator system roles independently from principal permissions", () => {
    expect(parseSystemRole("PLATFORM_ADMIN")).toBe("PLATFORM_ADMIN");
    expect(parseSystemRole("ANALYST")).toBe("ANALYST");
    expect(parseSystemRole("CLIENT")).toBe("CLIENT");
    expect(() => parseSystemRole("SEO_ANALYST")).toThrow("Unsupported system role");
    expect(() => parseSystemRole("SUPERUSER")).toThrow("Unsupported system role");
  });
});

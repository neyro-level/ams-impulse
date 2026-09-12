import { describe, expect, it } from "vitest";
import { AuthorizationService } from "../src/platform/authorization/authorization-service.ts";
import type { ProductProjectGrant } from "../src/platform/authorization/access-types.ts";
import {
  createDeniedJobPrincipal,
  createPlatformAdminPrincipal,
  createPlatformAnalystPrincipal,
  createTenantUserPrincipal,
} from "./helpers/principal.ts";

const grants: Record<string, ProductProjectGrant[]> = {
  analyst: [
    { product: "tools", organizationId: "tools-org", projectId: "tools-project", role: "ANALYST" },
  ],
  client: [
    { product: "seo-monitor", organizationId: "seo-org", projectId: "seo-a", role: "VIEWER" },
    { product: "leads", organizationId: "leads-org", projectId: "leads-a", role: "OPERATOR" },
  ],
};

const service = new AuthorizationService({
  async listProjectGrants(userId, product) {
    return (grants[userId] ?? []).filter((grant) => !product || grant.product === product);
  },
});

describe("AuthorizationService", () => {
  it("denies by default and requires a project scope", async () => {
    const client = createTenantUserPrincipal({ userId: "client", organizationId: "seo-org" });
    await expect(service.authorize(client, "seo:project:read", {
      product: "seo-monitor",
      organizationId: "",
      projectId: "",
    })).resolves.toEqual({
      allowed: false,
      code: "RESOURCE_SCOPE_REQUIRED",
    });
    await expect(service.authorize(client, "seo:project:read", {
      product: "seo-monitor",
      organizationId: "seo-org",
      projectId: "seo-b",
    })).resolves.toEqual({ allowed: false, code: "ACCESS_DENIED" });
    await expect(service.authorize(client, "seo:project:read", {
      product: "unknown-product",
      organizationId: "seo-org",
      projectId: "seo-a",
    })).resolves.toEqual({ allowed: false, code: "UNKNOWN_PRODUCT" });
  });

  it("isolates products and projects", async () => {
    const client = createTenantUserPrincipal({ userId: "client", organizationId: "seo-org" });
    await expect(service.listAccessibleProducts(client)).resolves.toEqual(["seo-monitor", "leads"]);
    await expect(service.listAccessibleProjectIds(client, "seo-monitor")).resolves.toEqual(["seo-a"]);
    await expect(service.authorize(client, "seo:report:read", {
      product: "seo-monitor",
      organizationId: "seo-org",
      projectId: "seo-a",
    })).resolves.toEqual({ allowed: true, role: "VIEWER" });
    await expect(service.authorize(client, "research:run", {
      product: "tools",
      organizationId: "tools-org",
      projectId: "tools-project",
    })).resolves.toEqual({ allowed: false, code: "ACCESS_DENIED" });
  });

  it("requires explicit grants for analysts", async () => {
    const analyst = createPlatformAnalystPrincipal("analyst");
    await expect(service.listAccessibleProducts(analyst)).resolves.toEqual(["tools"]);
    await expect(service.authorize(analyst, "research:run", {
      product: "tools",
      organizationId: "tools-org",
      projectId: "tools-project",
    })).resolves.toEqual({ allowed: true, role: "ANALYST" });
    await expect(service.listAccessibleProjectIds(analyst, "seo-monitor")).resolves.toEqual([]);
  });

  it("keeps the only global bypass on Platform Admin", async () => {
    await expect(service.listAccessibleProjectIds(createPlatformAdminPrincipal(), "seo-monitor")).resolves.toBeNull();
    await expect(service.authorize(createPlatformAdminPrincipal(), "research:run", {
      product: "tools",
      organizationId: "any-organization",
      projectId: "any",
    })).resolves.toEqual({ allowed: true, role: "PLATFORM_ADMIN" });
    await expect(service.authorize(createPlatformAdminPrincipal(), "research:run", {
      product: "tools",
      organizationId: "",
      projectId: "any",
    })).resolves.toEqual({ allowed: false, code: "RESOURCE_SCOPE_REQUIRED" });
    await expect(service.listAccessibleProducts(createDeniedJobPrincipal("seo-org"))).resolves.toEqual([]);
  });
});

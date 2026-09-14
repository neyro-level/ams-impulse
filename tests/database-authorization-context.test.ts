import { describe, expect, it } from "vitest";
import { deriveDatabaseAuthorizationContext } from "../src/platform/database/authorization-context.ts";
import type { PrincipalContext } from "../src/platform/authorization/principal.ts";

const correlationId = "00000000-0000-4000-8000-000000000002";

describe("database authorization context", () => {
  it("derives discriminated contexts from server principals", () => {
    expect(
      deriveDatabaseAuthorizationContext({
        kind: "tenant-user",
        userId: "user-1",
        organizationId: "organization-1",
        membershipId: "membership-1",
        role: "VIEWER",
        correlationId,
      }),
    ).toEqual({ kind: "user", userId: "user-1" });
    expect(
      deriveDatabaseAuthorizationContext({
        kind: "platform-admin",
        userId: "admin-1",
        correlationId,
      }),
    ).toEqual({ kind: "platform-admin", userId: "admin-1" });
    expect(
      deriveDatabaseAuthorizationContext({
        kind: "api-client",
        apiClientId: "api-1",
        organizationId: "organization-1",
        correlationId,
      }),
    ).toEqual({ kind: "api-client", apiClientId: "api-1", organizationId: "organization-1" });
    expect(
      deriveDatabaseAuthorizationContext({
        kind: "job",
        jobName: "research.run.v1",
        organizationId: "organization-1",
        projectId: "project-1",
        correlationId,
      }),
    ).toEqual({
      kind: "job",
      jobName: "research.run.v1",
      organizationId: "organization-1",
      projectId: "project-1",
    });
  });

  it("rejects a principal that cannot provide complete database scope", () => {
    const malformedJob = {
      kind: "job",
      jobName: "research.run.v1",
      organizationId: "organization-1",
      correlationId,
    } as unknown as PrincipalContext;

    expect(() =>
      deriveDatabaseAuthorizationContext(malformedJob),
    ).toThrow("AUTHORIZATION_CONTEXT_REQUIRED");
  });
});

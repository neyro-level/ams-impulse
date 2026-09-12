import { describe, expect, it } from "vitest";
import {
  PLATFORM_OPERATIONAL_MODELS,
  TENANT_OWNED_MODELS,
  isPlatformOperationalModel,
  isTenantOwnedModel,
} from "../src/platform/database/tenant-owned-models.ts";

describe("tenant-owned models registry", () => {
  it("separates tenant-owned business records from platform operational records", () => {
    expect(TENANT_OWNED_MODELS).toEqual(
      expect.arrayContaining([
        "Project",
        "Site",
        "ReportSnapshot",
        "SyncRun",
      ]),
    );
    expect(TENANT_OWNED_MODELS).not.toEqual(
      expect.arrayContaining(["AuditEvent", "IdempotencyKey", "OutboxEvent", "JobRun"]),
    );
    expect(PLATFORM_OPERATIONAL_MODELS).toEqual(
      expect.arrayContaining(["AuditEvent", "IdempotencyKey", "OutboxEvent", "JobRun"]),
    );
    expect(isTenantOwnedModel("ReportSnapshot")).toBe(true);
    expect(isTenantOwnedModel("OutboxEvent")).toBe(false);
    expect(isPlatformOperationalModel("OutboxEvent")).toBe(true);
    expect(isTenantOwnedModel("ThresholdProfile")).toBe(false);
  });
});

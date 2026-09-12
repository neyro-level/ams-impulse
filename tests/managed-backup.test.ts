import { describe, expect, it } from "vitest";
import { selectManagedBackup } from "../scripts/verify-managed-backup.mjs";

const now = new Date("2026-09-12T12:00:00.000Z");

describe("managed backup release gate", () => {
  it("selects the newest completed backup inside the freshness window", () => {
    const result = selectManagedBackup([
      { id: 1, status: "done", created_at: "2026-09-12T09:00:00.000Z" },
      { id: 2, status: "create", created_at: "2026-09-12T11:59:00.000Z" },
      { id: 3, status: "done", created_at: "2026-09-12T11:30:00.000Z" },
    ], { now, maxAgeSeconds: 7_200 });

    expect(result.backup.id).toBe(3);
    expect(result.ageSeconds).toBe(1_800);
  });

  it("fails closed for a stale backup", () => {
    expect(() => selectManagedBackup([
      { id: 1, status: "done", created_at: "2026-09-12T09:00:00.000Z" },
    ], { now, maxAgeSeconds: 7_200 })).toThrow("provider_backup_stale=true");
  });

  it("requires the explicit completed restore point for destructive migrations", () => {
    expect(() => selectManagedBackup([
      { id: 4, status: "done", created_at: "2026-09-12T11:30:00.000Z" },
    ], { now, maxAgeSeconds: 7_200, restorePointId: "different" }))
      .toThrow("provider_restore_point_missing=true");
  });
});

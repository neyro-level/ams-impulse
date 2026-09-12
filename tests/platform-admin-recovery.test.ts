import { describe, expect, it } from "vitest";
import {
  createPlatformAdminRecoveryBatch,
  hashPlatformAdminRecoveryCode,
} from "../src/platform/auth/platform-admin-recovery.ts";

describe("Platform Admin recovery material", () => {
  it("creates ten unique high-entropy one-time codes and stores only their hashes", () => {
    const batch = createPlatformAdminRecoveryBatch("admin-1");
    expect(batch.codes).toHaveLength(10);
    expect(new Set(batch.codes)).toHaveLength(10);
    expect(batch.codes.every((code) => /^[A-Za-z0-9]{24}$/.test(code))).toBe(true);
    expect(batch.records).toHaveLength(10);
    expect(new Set(batch.records.map((record) => record.codeHash))).toHaveLength(10);
    for (const [index, record] of batch.records.entries()) {
      expect(record.userId).toBe("admin-1");
      expect(record.batchId).toBe(batch.batchId);
      expect(record.codeHash).toBe(hashPlatformAdminRecoveryCode(batch.codes[index]));
      expect(record).not.toHaveProperty("code");
    }
  });

  it("uses a stable one-way digest without retaining plaintext", () => {
    const code = "AbCdEf0123456789GhIjKlMn";
    expect(hashPlatformAdminRecoveryCode(code)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashPlatformAdminRecoveryCode(code)).toBe(hashPlatformAdminRecoveryCode(code));
    expect(hashPlatformAdminRecoveryCode(`${code}X`)).not.toBe(hashPlatformAdminRecoveryCode(code));
  });
});

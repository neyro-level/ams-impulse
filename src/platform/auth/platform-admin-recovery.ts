import { createHash, randomUUID } from "node:crypto";
import { generateRandomString } from "better-auth/crypto";

export function hashPlatformAdminRecoveryCode(code: string) {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function createPlatformAdminRecoveryBatch(userId: string) {
  const batchId = randomUUID();
  const codes = Array.from({ length: 10 }, () =>
    generateRandomString(24, "a-z", "A-Z", "0-9"));
  return {
    batchId,
    codes,
    records: codes.map((code) => ({
      id: randomUUID(),
      userId,
      batchId,
      codeHash: hashPlatformAdminRecoveryCode(code),
    })),
  };
}

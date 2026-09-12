CREATE TABLE "PlatformAdminRecoveryCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  "revokedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlatformAdminRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAdminRecoveryCode_userId_codeHash_key"
  ON "PlatformAdminRecoveryCode"("userId", "codeHash");

CREATE INDEX "PlatformAdminRecoveryCode_userId_batchId_idx"
  ON "PlatformAdminRecoveryCode"("userId", "batchId");

ALTER TABLE "PlatformAdminRecoveryCode"
  ADD CONSTRAINT "PlatformAdminRecoveryCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

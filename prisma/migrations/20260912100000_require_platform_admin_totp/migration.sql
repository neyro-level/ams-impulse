-- Better Auth TOTP enrollment is mandatory before PLATFORM_ADMIN authority can be issued.
ALTER TABLE "User"
  ADD COLUMN "twoFactorEnabled" BOOLEAN DEFAULT false;

CREATE TABLE "TwoFactor" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "backupCodes" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT true,
  "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMPTZ(3),

  CONSTRAINT "TwoFactor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TwoFactor_userId_key" ON "TwoFactor"("userId");

ALTER TABLE "TwoFactor"
  ADD CONSTRAINT "TwoFactor_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

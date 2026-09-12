CREATE TABLE "McpSubjectRateLimit" (
  "key" TEXT NOT NULL,
  "subjectHash" TEXT NOT NULL,
  "windowStartedAt" TIMESTAMPTZ(3) NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "McpSubjectRateLimit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "McpSubjectRateLimit_expiresAt_idx" ON "McpSubjectRateLimit"("expiresAt");

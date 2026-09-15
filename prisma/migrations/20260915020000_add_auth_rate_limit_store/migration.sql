CREATE TABLE "RateLimit" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "lastRequest" BIGINT NOT NULL,

  CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");
CREATE INDEX "RateLimit_lastRequest_idx" ON "RateLimit"("lastRequest");

REVOKE ALL PRIVILEGES ON TABLE "RateLimit" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE "RateLimit" FROM ams_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "RateLimit" TO ams_web;
GRANT SELECT ON TABLE "RateLimit" TO ams_backup;

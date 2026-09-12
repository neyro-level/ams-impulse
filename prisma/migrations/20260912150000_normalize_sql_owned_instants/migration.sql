-- Research and Tools timestamps are application-owned UTC instants.
-- Existing values were written from JavaScript Date/current_timestamp and therefore
-- have UTC semantics; make that storage contract explicit without touching
-- Better Auth or OAuth-managed columns in public.
ALTER TABLE "tools"."ToolsOrganization"
  ALTER COLUMN "archivedAt" TYPE timestamptz(3) USING "archivedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE timestamptz(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE timestamptz(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "tools"."ToolsProject"
  ALTER COLUMN "archivedAt" TYPE timestamptz(3) USING "archivedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE timestamptz(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE timestamptz(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "tools"."ToolsMembership"
  ALTER COLUMN "createdAt" TYPE timestamptz(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE timestamptz(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "tools"."ToolsProjectAccess"
  ALTER COLUMN "createdAt" TYPE timestamptz(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE timestamptz(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "research"."Research"
  ALTER COLUMN "archivedAt" TYPE timestamptz(3) USING "archivedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE timestamptz(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE timestamptz(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "research"."Query"
  ALTER COLUMN "createdAt" TYPE timestamptz(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "research"."Run"
  ALTER COLUMN "estimateExpiresAt" TYPE timestamptz(3) USING "estimateExpiresAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "confirmedAt" TYPE timestamptz(3) USING "confirmedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "startedAt" TYPE timestamptz(3) USING "startedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "finishedAt" TYPE timestamptz(3) USING "finishedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE timestamptz(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE timestamptz(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "research"."QueryRun"
  ALTER COLUMN "startedAt" TYPE timestamptz(3) USING "startedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "finishedAt" TYPE timestamptz(3) USING "finishedAt" AT TIME ZONE 'UTC';

ALTER TABLE "research"."Evidence"
  ALTER COLUMN "collectedAt" TYPE timestamptz(3) USING "collectedAt" AT TIME ZONE 'UTC';

ALTER TABLE "research"."Export"
  ALTER COLUMN "expiresAt" TYPE timestamptz(3) USING "expiresAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE timestamptz(3) USING "createdAt" AT TIME ZONE 'UTC';

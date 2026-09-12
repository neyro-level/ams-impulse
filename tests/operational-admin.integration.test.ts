import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listOperations } from "../src/modules/platform-operations/server.ts";
import type { PrincipalContext } from "../src/platform/authorization/principal.ts";
import { closePrismaClient, getPrismaClient } from "../src/platform/database/prisma/client.ts";

const integrationEnabled = Boolean(
  process.env.DATABASE_HOST
    && process.env.DATABASE_USER
    && process.env.DATABASE_PASSWORD
    && process.env.DATABASE_NAME,
);
const integrationDescription = integrationEnabled ? describe : describe.skip;
const prefix = "operational-admin-proof";
const eventId = `${prefix}-event`;
const correlationId = "00000000-0000-4000-8000-000000000511";
const admin: PrincipalContext = { kind: "platform-admin", userId: `${prefix}-admin`, correlationId };

integrationDescription("Platform Admin incident workspace", () => {
  let proofRoot = "";

  beforeAll(async () => {
    proofRoot = await mkdtemp(join(tmpdir(), `${prefix}-`));
    process.env.OPERATIONAL_PROOF_ROOT = proofRoot;
    const proof = (kind: "backup" | "live") => JSON.stringify({
      kind,
      status: "passed",
      occurredAt: "2026-09-12T00:00:00.000Z",
      releaseSha: "a".repeat(40),
    });
    await Promise.all([
      writeFile(join(proofRoot, "backup.json"), proof("backup")),
      writeFile(join(proofRoot, "live.json"), proof("live")),
    ]);
    const prisma = getPrismaClient();
    await prisma.outboxEvent.deleteMany({ where: { id: eventId } });
    await prisma.outboxEvent.create({
      data: {
        id: eventId,
        topic: `${prefix}.topic`,
        payload: { marker: prefix },
        status: "DEAD_LETTER",
        attempts: 3,
        lastErrorCode: "PROOF_FAILURE",
        correlationId,
        jobRuns: {
          create: {
            id: `${prefix}-job`,
            jobType: `${prefix}.job`,
            status: "FAILED",
            attempt: 3,
            workerId: `${prefix}-worker`,
            startedAt: new Date("2026-09-12T00:00:00.000Z"),
            finishedAt: new Date("2026-09-12T00:01:00.000Z"),
            safeErrorCode: "PROOF_FAILURE",
            correlationId,
          },
        },
      },
    });
  });

  afterAll(async () => {
    await getPrismaClient().outboxEvent.deleteMany({ where: { id: eventId } });
    await closePrismaClient();
    delete process.env.OPERATIONAL_PROOF_ROOT;
    if (proofRoot) await rm(proofRoot, { recursive: true, force: true });
  });

  it("returns actionable safe incidents and valid release proofs", async () => {
    const incidents = await listOperations(admin, {
      search: prefix,
      page: 1,
      pageSize: 20,
      sort: "updatedAt",
      direction: "desc",
    });
    expect(incidents.items.map(({ kind }) => kind)).toEqual(expect.arrayContaining(["failed-job", "dead-letter"]));
    expect(JSON.stringify(incidents.items)).toContain(correlationId);
    expect(JSON.stringify(incidents.items)).not.toContain("marker");

    const proofs = await listOperations(admin, {
      search: "Последнее подтверждение",
      page: 1,
      pageSize: 20,
      sort: "name",
      direction: "asc",
    });
    expect(proofs.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "backup-proof", status: "Подтверждено" }),
      expect.objectContaining({ kind: "live-proof", status: "Подтверждено" }),
    ]));
  });
});

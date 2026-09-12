import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readOperationalProof } from "../src/modules/platform-operations/infrastructure/operational-proof.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("operational proof reader", () => {
  it("reads a safe exact-release marker", async () => {
    const root = await mkdtemp(join(tmpdir(), "ams-operational-proof-"));
    roots.push(root);
    await writeFile(join(root, "backup.json"), JSON.stringify({
      kind: "backup",
      status: "passed",
      occurredAt: "2026-09-12T00:00:00.000Z",
      releaseSha: "a".repeat(40),
    }));

    await expect(readOperationalProof("backup", root)).resolves.toMatchObject({
      kind: "backup",
      releaseSha: "a".repeat(40),
    });
  });

  it("fails closed for a missing or malformed marker", async () => {
    const root = await mkdtemp(join(tmpdir(), "ams-operational-proof-"));
    roots.push(root);
    await writeFile(join(root, "live.json"), '{"kind":"live","status":"passed","releaseSha":"unsafe"}');

    await expect(readOperationalProof("backup", root)).resolves.toBeNull();
    await expect(readOperationalProof("live", root)).resolves.toBeNull();
  });
});

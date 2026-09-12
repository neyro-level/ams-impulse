import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const identityCommands = readFileSync(
  new URL("../src/modules/identity-access/application/identity-admin-commands.ts", import.meta.url),
  "utf8",
);
const registryCommands = readFileSync(
  new URL("../src/modules/project-registry/application/platform-admin-commands.ts", import.meta.url),
  "utf8",
);
const identityRuntime = readFileSync(
  new URL("../src/modules/identity-access/infrastructure/identity-admin-runtime.ts", import.meta.url),
  "utf8",
);
const registryRuntime = readFileSync(
  new URL("../src/modules/project-registry/infrastructure/platform-admin-runtime.ts", import.meta.url),
  "utf8",
);

describe("Platform Admin command boundary", () => {
  it("keeps mutations inside defineCommand and records audit events", () => {
    for (const source of [identityCommands, registryCommands]) {
      expect(source).toContain("defineCommand<");
      expect(source).toContain("transaction");
      expect(source).toContain("appendAudit");
      expect(source).not.toContain("getPrismaClient");
      expect(source).not.toContain(".$transaction");
    }
  });

  it("constructs mutation repositories from the contextual command transaction", () => {
    for (const source of [identityRuntime, registryRuntime]) {
      expect(source).toContain("createRepository(transaction: DatabaseTransaction)");
      expect(source).toContain("Repository(transaction)");
    }
  });
});

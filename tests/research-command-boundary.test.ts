import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const commands = readFileSync(new URL("../src/modules/research/application/research-commands.ts", import.meta.url), "utf8");
const repository = readFileSync(new URL("../src/modules/research/infrastructure/prisma-research-repository.ts", import.meta.url), "utf8");

describe("Research command boundary", () => {
  it("defines every business mutation as a platform command", () => {
    for (const name of ["research.create", "research.update", "research.archive", "research.run.estimate", "research.run.confirm-and-queue", "research.run.cancel"]) {
      expect(commands).toContain(`name: "${name}"`);
    }
  });

  it("passes the command transaction into mutation repository methods", () => {
    for (const operation of ["repository.create", "repository.update", "repository.archive", "repository.reserveRunEstimate", "repository.confirmRun", "repository.cancelRun"]) {
      const qualifiedOperation = `dependencies.${operation}`;
      const call = commands.slice(commands.indexOf(qualifiedOperation), commands.indexOf(qualifiedOperation) + 900);
      expect(call).toContain("transaction");
    }
  });

  it("does not open repository-owned transactions inside mutation methods", () => {
    const mutationSection = repository.slice(repository.indexOf("async create("));
    expect(mutationSection).not.toContain("this.withContext");
  });
});

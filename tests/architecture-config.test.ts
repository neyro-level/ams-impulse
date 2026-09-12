import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

describe("bounded module privacy configuration", () => {
  it("derives a privacy rule for every module directory", () => {
    const configuration = require("../dependency-cruiser.config.cjs") as {
      forbidden: Array<{ name: string; from: { pathNot?: string }; to: { path?: string } }>;
    };
    const moduleNames = readdirSync("src/modules", { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const guardedNames = configuration.forbidden
      .map((rule) => rule.name)
      .filter((name) => name.startsWith("module-internals-are-private:"))
      .map((name) => name.slice("module-internals-are-private:".length))
      .sort();

    expect(guardedNames).toEqual(moduleNames);
    for (const moduleName of moduleNames) {
      const rule = configuration.forbidden.find(
        (candidate) => candidate.name === `module-internals-are-private:${moduleName}`,
      );
      expect(rule?.from.pathNot).toBe(`^src/modules/${moduleName}/`);
      expect(rule?.to.path).toContain(`^src/modules/${moduleName}/`);
    }
  });
});

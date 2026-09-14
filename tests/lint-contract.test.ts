import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("typed async lint contract", () => {
  it("uses Project Service for both production TypeScript roots", () => {
    const config = readFileSync("eslint.config.mjs", "utf8");
    const collectorConfig = readFileSync("collector/tsconfig.json", "utf8");
    const rootTsconfig = readFileSync("tsconfig.json", "utf8");

    expect(config).toContain('files: ["src/**/*.{ts,tsx}", "collector/**/*.ts"]');
    expect(config).toContain("projectService: true");
    expect(config).toContain('"@typescript-eslint/no-floating-promises": "error"');
    expect(config).toContain('"@typescript-eslint/no-misused-promises"');
    expect(config).toContain("checksVoidReturn: { attributes: false }");
    expect(collectorConfig).toContain('"extends": "../tsconfig.collector.json"');
    expect(rootTsconfig).toContain('"src/app/.well-known/**/*.ts"');
  });

  it("does not add inline escape hatches for the typed async rules", () => {
    const config = readFileSync("eslint.config.mjs", "utf8");
    expect(config).not.toContain("allowForKnownSafePromises");
    expect(config).not.toContain("allowForKnownSafeCalls");
  });
});

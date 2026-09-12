import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("application cache strategy", () => {
  it("keeps private routes no-store and cache components disabled", async () => {
    const config = await readFile("next.config.ts", "utf8");
    expect(config).toContain('source: "/(api|mcp|tools|dashboard|analyst|admin|notifications|c|consent|demo)/:path*"');
    expect(config).toContain('{ key: "Cache-Control", value: "private, no-store" }');
    expect(config).not.toMatch(/cacheComponents\s*:/);
  });

  it("does not introduce tagged caches without an invalidation contract", async () => {
    const architecture = await readFile("docs/ARCHITECTURE.md", "utf8");
    expect(architecture).toContain("Principal and grant memoization is React server-render-scoped");
    expect(architecture).toContain("actions, route handlers and workers do not depend on it");
    expect(architecture).toContain("`updateTag`/tagged read models are introduced only");
  });
});

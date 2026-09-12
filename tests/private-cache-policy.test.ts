import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("private route cache policy", () => {
  it("covers application, auth context, MCP, consent and fixture routes", () => {
    const config = readFileSync("next.config.ts", "utf8");
    for (const segment of [
      "api",
      "mcp",
      "tools",
      "dashboard",
      "analyst",
      "admin",
      "notifications",
      "c",
      "consent",
      "demo",
    ]) {
      expect(config).toContain(segment);
    }
    expect(config).toContain('{ key: "Cache-Control", value: "private, no-store" }');
  });

  it("sets no-store directly on auth and MCP responses", () => {
    const authRoute = readFileSync("src/app/api/auth/[...all]/route.ts", "utf8");
    const mcpRoute = readFileSync("src/app/mcp/route.ts", "utf8");
    expect(authRoute).toContain('response.headers.set("Cache-Control", "no-store")');
    expect(mcpRoute).toContain('response.headers.set("Cache-Control", "no-store")');
  });

  it("keeps generated exports and signed downloads explicitly private", () => {
    const storage = readFileSync(
      "src/modules/research/infrastructure/s3-private-export-storage.ts",
      "utf8",
    );
    expect(storage).toContain('CacheControl: "private, no-store"');
    expect(storage).toContain('ResponseCacheControl: "private, no-store"');
  });

  it("marks discovery and every private surface no-store", () => {
    const config = readFileSync("next.config.ts", "utf8");
    expect(config).toContain('source: "/.well-known/:path*"');
    expect(config).toContain('{ key: "Cache-Control", value: "no-store" }');
    expect(config).toContain('{ key: "Cache-Control", value: "private, no-store" }');
  });
});

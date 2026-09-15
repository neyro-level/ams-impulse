import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json";

const read = (path: string) => readFileSync(path, "utf8");

describe("canonical local development port", () => {
  it("keeps direct dev, managed launcher, auth origins and docs on 3001", () => {
    expect(packageJson.scripts.dev).toBe("next dev --hostname 127.0.0.1 --port 3001");

    const launcher = read("scripts/local-dev.mjs");
    const auth = read("src/platform/auth/auth.ts");
    expect(launcher).toContain("const port = 3001;");
    expect(auth).toContain('"http://127.0.0.1:3001"');
    expect(auth).toContain('"http://localhost:3001"');
    expect(auth).not.toContain('"http://127.0.0.1:3000"');
    expect(auth).not.toContain('"http://localhost:3000"');

    for (const document of [read("README.md"), read("docs/ops/LOCAL_DEVELOPMENT.md")]) {
      expect(document).toContain("http://127.0.0.1:3001");
    }
  });

  it("does not alter the separate production loopback port", () => {
    expect(read("docker-compose.production.yml")).toContain(
      "http://127.0.0.1:3000/api/health/live",
    );
    expect(read("ops/nginx/ams-seo-monitor.conf")).toContain(
      "proxy_pass http://127.0.0.1:3000;",
    );
  });
});

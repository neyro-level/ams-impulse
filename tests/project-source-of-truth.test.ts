import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("project source-of-truth", () => {
  it("uses one canonical product, package and SourceCraft identity", () => {
    const packageJson = JSON.parse(read("package.json")) as { name: string };
    expect(packageJson.name).toBe("ams-impulse");
    expect(read("AGENTS.md")).toContain("`integrator-p/ams-impulse`");
    expect(read("scripts/build-release.mjs")).toContain('repository: "integrator-p/ams-impulse"');
  });

  it("documents the historical runtime slug as compatibility only", () => {
    for (const path of ["README.md", "docs/ARCHITECTURE.md", "docs/RUNBOOK_DEPLOY.md"]) {
      const document = read(path);
      expect(document, path).toContain("ams-seo-monitor");
      expect(document, path).toMatch(/histor|Истор|existing production paths/u);
    }
  });

  it("keeps release state separate from implemented main state", () => {
    expect(read("README.md")).toContain("Production feature set определяется только deployed SHA");
    expect(read("docs/ARCHITECTURE.md")).toContain("наличие в production");
    expect(read("docs/PRODUCT.md")).toContain("Production availability определяется deployed exact SHA");
  });

  it("keeps final conformance free of closed remediation findings", () => {
    const conformance = read("docs/PLATFORM_CONFORMANCE.md");
    for (const stale of [
      "Platform Admin MFA | NOT_IMPLEMENTED",
      "общий `defineCommand` пока не устанавливает",
      "persistent Research worker отсутствует",
      "unauthenticated dynamic client registration пока не ограничена",
      "production layer содержит full `node_modules`",
    ]) {
      expect(conformance).not.toContain(stale);
    }
  });

  it("describes the exact static-only PWA allowlist", () => {
    const readme = read("README.md");
    expect(readme).toContain("`/_next/static/*`");
    expect(readme).not.toContain("`/fonts/*`");
  });
});

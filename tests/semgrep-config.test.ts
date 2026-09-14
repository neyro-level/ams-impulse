import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const RULE_IDS = [
  "ams.dynamic-code-execution",
  "ams.child-process-shell",
  "ams.child-process-exec",
  "ams.prisma-unsafe-raw",
  "ams.tls-verification-disabled",
  "ams.environment-url-fetch",
  "ams.hardcoded-secret",
] as const;

describe("Semgrep guard contract", () => {
  it("keeps every local rule covered by the executable fixture verifier", async () => {
    const [config, verifier] = await Promise.all([
      readFile(".semgrep.yml", "utf8"),
      readFile("scripts/verify-semgrep-rules.mjs", "utf8"),
    ]);

    for (const ruleId of RULE_IDS) {
      expect(config).toContain(`id: ${ruleId}`);
      expect(verifier).toContain(`"${ruleId}"`);
    }
    expect(verifier).toContain('scan("fixtures/semgrep/positive.ts")');
    expect(verifier).toContain('scan("fixtures/semgrep/negative.ts")');
  });

  it("uses executable whitespace regex and runs rule tests before the source scan", async () => {
    const [config, packageJson] = await Promise.all([
      readFile(".semgrep.yml", "utf8"),
      readFile("package.json", "utf8"),
    ]);

    expect(config).toContain("(?i)(secret|password|passwd|token|api[_-]?key|private[_-]?key)\\s*[:=]\\s*");
    expect(config).not.toContain("key)\\\\s*[:=]\\\\s*");
    expect(JSON.parse(packageJson).scripts["security:semgrep"]).toMatch(
      /^pnpm security:semgrep:rules && semgrep scan /,
    );
  });
});

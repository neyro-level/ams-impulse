import { describe, expect, it } from "vitest";
import { classifyRiskPaths } from "../scripts/risk-classify.ts";

describe("risk classifier", () => {
  it("flags data, auth, module infrastructure, Docker and SourceCraft paths", () => {
    expect(
      classifyRiskPaths([
        "prisma/migrations/20260912_example/migration.sql",
        "src/platform/auth/auth.ts",
        "src/modules/research/infrastructure/repository.ts",
        "Dockerfile",
        ".sourcecraft/ci.yaml",
      ]).map(({ path }) => path),
    ).toEqual([
      ".sourcecraft/ci.yaml",
      "Dockerfile",
      "prisma/migrations/20260912_example/migration.sql",
      "src/modules/research/infrastructure/repository.ts",
      "src/platform/auth/auth.ts",
    ]);
  });

  it("does not turn an unmatched presentation path into a safety verdict", () => {
    expect(classifyRiskPaths(["src/components/ui/button.tsx"])).toEqual([]);
  });

  it("flags every server and delivery boundary from the project risk contract", () => {
    const paths = [
      ".env.example",
      ".semgrep.yml",
      "collector/sources/topvisor.ts",
      "scripts/ci/run-scoped-proof.mjs",
      "scripts/runtime-entrypoint.mjs",
      "scripts/verify-architecture.mjs",
      "src/modules/research/worker.ts",
      "src/platform/http/client.ts",
      "src/platform/mcp/server.ts",
    ];

    expect(classifyRiskPaths(paths).map(({ path }) => path)).toEqual([...paths].sort());
  });

  it("normalizes Windows paths and removes duplicates", () => {
    expect(
      classifyRiskPaths([".\\src\\platform\\database\\transaction.ts", "src/platform/database/transaction.ts"]),
    ).toEqual([
      {
        path: "src/platform/database/transaction.ts",
        reasons: ["platform database"],
      },
    ]);
  });
});

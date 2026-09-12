import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  parseBoolean,
  parseTestFiles,
} from "../scripts/ci/run-scoped-proof.mjs";

describe("scoped merge proof", () => {
  it("keeps PR verification cheap and merge proofs manual exact-head workflows", () => {
    const workflow = readFileSync(path.resolve(".sourcecraft/ci.yaml"), "utf8");
    const triggerBlock = workflow.slice(
      workflow.indexOf("on:"),
      workflow.indexOf("\nworkflows:\n"),
    );
    const standardCheck = workflow.slice(
      workflow.indexOf("  standard-check:"),
      workflow.indexOf("  risky-check:"),
    );
    const riskyCheck = workflow.slice(
      workflow.indexOf("  risky-check:"),
      workflow.indexOf("  daily:"),
    );

    expect(triggerBlock).toContain("workflows: [daily]");
    expect(triggerBlock).not.toContain("pull_request");
    expect(triggerBlock).not.toContain("standard-check");
    expect(triggerBlock).not.toContain("risky-check");
    expect(workflow.match(/^  standard-check:$/gmu)).toHaveLength(1);
    expect(standardCheck).toContain("node scripts/ci/verify-exact-head.mjs");
    expect(standardCheck).toContain("run-scoped-proof.mjs unit");
    expect(riskyCheck).toContain("run-scoped-proof.mjs integration");
    expect(riskyCheck).toContain("run-scoped-proof.mjs optional-risk");
  });

  it("accepts explicit existing test files and removes duplicates", () => {
    expect(
      parseTestFiles(
        "tests/architecture-config.test.ts, tests/architecture-config.test.ts",
        "UNIT_TEST_FILES",
      ),
    ).toEqual(["tests/architecture-config.test.ts"]);
  });

  it("rejects empty, traversal, and missing test selections", () => {
    expect(() => parseTestFiles("", "UNIT_TEST_FILES")).toThrow(/at least one/u);
    expect(() => parseTestFiles("tests/../secret.test.ts", "UNIT_TEST_FILES")).toThrow(
      /invalid/u,
    );
    expect(() => parseTestFiles("tests/missing.test.ts", "UNIT_TEST_FILES")).toThrow(
      /missing/u,
    );
  });

  it("accepts only explicit boolean risk flags", () => {
    expect(parseBoolean("true", "RUN_BUILD")).toBe(true);
    expect(parseBoolean("false", "RUN_BUILD")).toBe(false);
    expect(() => parseBoolean("1", "RUN_BUILD")).toThrow(/true or false/u);
  });
});

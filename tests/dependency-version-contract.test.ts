import { describe, expect, it } from "vitest";
import packageJson from "../package.json";
import { findDependencyVersionRanges } from "../scripts/lib/exact-dependency-versions.mjs";

describe("exact dependency version contract", () => {
  it("keeps every declared dependency on an exact semantic version", () => {
    expect(findDependencyVersionRanges(packageJson)).toEqual([]);
  });

  it("rejects range, tag, workspace and source specifications", () => {
    expect(findDependencyVersionRanges({
      dependencies: {
        caret: "^1.2.3",
        tilde: "~1.2.3",
        tag: "latest",
        workspace: "workspace:*",
        source: "git+https://example.invalid/package.git",
      },
      devDependencies: { exact: "1.2.3" },
    })).toEqual([
      "dependencies.caret=^1.2.3",
      "dependencies.tilde=~1.2.3",
      "dependencies.tag=latest",
      "dependencies.workspace=workspace:*",
      "dependencies.source=git+https://example.invalid/package.git",
    ]);
  });
});

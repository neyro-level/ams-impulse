import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("server-render-scoped cache policy", () => {
  it("memoizes principal resolution in React server renders, never a module singleton", async () => {
    const source = await readFile("src/platform/auth/principal-session.ts", "utf8");
    expect(source).toContain('import { cache } from "react"');
    expect(source).toContain("const getFreshPrincipalState = cache(async");
    expect(source).not.toMatch(/let\s+.*principal.*cache/i);
  });

  it("keys grant reuse to the current React server render without a durable ACL map", async () => {
    const source = await readFile(
      "src/modules/identity-access/infrastructure/prisma-access-grant-repository.ts",
      "utf8",
    );
    expect(source).toContain("const loadProjectGrantsForRequest = cache(loadProjectGrants)");
    expect(source).toContain("loadProjectGrantsForRequest(this.prisma, userId, product)");
    expect(source).not.toMatch(/new\s+Map/);
  });
});

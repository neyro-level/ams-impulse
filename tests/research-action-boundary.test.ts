import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const actions = readFileSync(new URL("../src/app/tools/research/actions.ts", import.meta.url), "utf8");

describe("Research UI action boundary", () => {
  it("routes every UI mutation through defineAction", () => {
    expect(actions.match(/defineAction</g)).toHaveLength(6);
    expect(actions).not.toContain("requireCurrentCabinetPrincipal");
  });

  it("keeps Next.js navigation outside defined action executions", () => {
    expect(actions).not.toMatch(/execute:[\s\S]{0,300}(?:redirect|notFound)\(/);
    expect(actions.indexOf("redirect(")).toBeGreaterThan(actions.indexOf("export async function createResearchAction"));
  });

  it("maps Research errors and configures post-commit invalidation", () => {
    expect(actions).toContain("mapError: mapResearchError");
    expect(actions).toContain("revalidate:");
  });
});

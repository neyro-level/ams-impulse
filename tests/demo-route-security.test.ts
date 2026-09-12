import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("demo fixture route", () => {
  it("requires a server-issued Platform Admin principal", () => {
    const source = readFileSync("src/app/demo/page.tsx", "utf8");
    expect(source).toContain('state.principal.kind !== "platform-admin"');
    expect(source).toContain('redirect("/dashboard/")');
  });
});

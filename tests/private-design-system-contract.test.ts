import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("private application design-system contract", () => {
  it("applies the private viewport to every private route root", async () => {
    const layouts = await Promise.all(
      ["admin", "analyst", "c", "dashboard", "demo", "notifications", "tools"].map((segment) =>
        readFile(`src/app/${segment}/layout.tsx`, "utf8"),
      ),
    );
    for (const layout of layouts) expect(layout).toContain("PRIVATE_APP_VIEWPORT");
  });

  it("keeps embedded operational filters free of nested panel chrome", async () => {
    const analyst = await readFile("src/app/analyst/page.tsx", "utf8");
    const research = await readFile("src/app/tools/research/page.tsx", "utf8");
    expect(analyst).toContain('<FilterBar surface="plain"');
    expect(research).toContain('<FilterBar surface="plain"');
  });

  it("tracks the current decision-first screens in visual QA", async () => {
    const visual = await readFile("tests/e2e/visual-baseline.spec.ts", "utf8");
    expect(visual).toContain('heading: "Рабочая сводка"');
    expect(visual).toContain('path: "/analyst/"');
    expect(visual).toContain('path: "/tools/research/"');
  });
});

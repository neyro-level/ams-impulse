import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Research paid estimate UI contract", () => {
  it("keeps only runId in the URL and renders cost from persisted run state", async () => {
    const actions = await readFile("src/app/tools/research/actions.ts", "utf8");
    const page = await readFile("src/app/tools/research/[researchId]/page.tsx", "utf8");

    expect(actions).toContain("{ runId: estimate.runId }");
    expect(actions).not.toContain("estimateCost:");
    expect(actions).not.toContain("estimateQueries:");
    expect(page).toContain("runs.find((run) => run.runId === estimateRunId");
    expect(page).toContain("estimate.estimatedCostKopecks");
    expect(page).not.toContain("raw.estimateCost");
    expect(page).not.toContain("raw.estimateQueries");
  });

  it("uses mobile cards instead of a horizontally scrolling run table", async () => {
    const page = await readFile("src/app/tools/research/[researchId]/page.tsx", "utf8");
    const list = await readFile("src/app/tools/research/page.tsx", "utf8");

    expect(page).not.toContain("overflow-x-auto");
    expect(page).toContain('className="grid gap-3 md:hidden"');
    expect(list).toContain("MobileFilterSheet");
  });

  it("names tables and exposes live action feedback", async () => {
    const detail = await readFile("src/app/tools/research/[researchId]/page.tsx", "utf8");
    const list = await readFile("src/app/tools/research/page.tsx", "utf8");
    const actionState = await readFile("src/components/research/ResearchActionState.tsx", "utf8");
    const routeError = await readFile("src/components/states/PrivateRouteError.tsx", "utf8");

    expect(detail).toContain("<caption className=\"sr-only\"");
    expect(detail).toContain('scope="col"');
    expect(list).toContain("<TableCaption className=\"sr-only\"");
    expect(actionState).toContain('aria-live="polite"');
    expect(routeError).toContain("containerRef.current?.focus()");
  });
});

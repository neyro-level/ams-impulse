import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("SEO client route access contract", () => {
  it("fails the project route closed before rendering its shell", async () => {
    const source = await readFile("src/app/c/[clientSlug]/page.tsx", "utf8");
    const resolveAt = source.indexOf("buildClientOverview(state.principal, clientSlug)");
    const notFoundAt = source.indexOf("notFound()", resolveAt);
    const renderAt = source.indexOf("return (", notFoundAt);
    expect(resolveAt).toBeGreaterThan(-1);
    expect(notFoundAt).toBeGreaterThan(resolveAt);
    expect(renderAt).toBeGreaterThan(notFoundAt);
  });

  it("authorizes the exact site before reading report data", async () => {
    const source = await readFile("src/app/c/[clientSlug]/[siteSlug]/page.tsx", "utf8");
    const authorizeAt = source.indexOf("getSiteAccessForUser(state.principal, clientSlug, siteSlug)");
    const notFoundAt = source.indexOf("notFound()", authorizeAt);
    const reportAt = source.indexOf("getSiteReportForUser", notFoundAt);
    expect(authorizeAt).toBeGreaterThan(-1);
    expect(notFoundAt).toBeGreaterThan(authorizeAt);
    expect(reportAt).toBeGreaterThan(notFoundAt);
  });
});

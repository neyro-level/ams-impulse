import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in.ts";

const canonicalWidths = new Set([375, 768, 1280, 1440]);
const criticalScreens = [
  { name: "dashboard", path: "/dashboard/", heading: "Рабочая сводка" },
  { name: "analyst", path: "/analyst/", heading: "Проекты" },
  { name: "projects", path: "/admin/projects/", heading: "Проекты" },
  { name: "research", path: "/tools/research/", heading: "Исследования" },
  { name: "report", path: "/demo/", heading: "Synthetic overview" },
] as const;

test.describe("Private visual QA baseline", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await signIn(page, testInfo, "e2e.platform.admin");
  });

  test("captures critical screens without page-level overflow", async ({ page }, testInfo) => {
    const width = page.viewportSize()?.width;
    expect(width, "Playwright project must use a canonical private UI width").toBeDefined();
    expect(canonicalWidths.has(width!)).toBe(true);

    for (const screen of criticalScreens) {
      await page.goto(screen.path);
      await expect(page.getByRole("heading", { level: 1, name: screen.heading })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await testInfo.attach(`${screen.name}-${width}`, {
        body: await page.screenshot({ fullPage: true, animations: "disabled" }),
        contentType: "image/png",
      });
    }
  });
});

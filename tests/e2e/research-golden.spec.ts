import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { E2E_RESEARCH } from "../../scripts/e2e-research-contract.ts";
import { researchAnalystAuthStatePath } from "./auth-state.ts";
import { signIn } from "./sign-in.ts";

const allowedListUrl = `/tools/research/?organizationId=${E2E_RESEARCH.allowedOrganizationId}&projectId=${E2E_RESEARCH.allowedProjectId}`;
const detailUrl = (researchId: string, organizationId: string, projectId: string) =>
  `/tools/research/${researchId}/?organizationId=${organizationId}&projectId=${projectId}`;

test.describe("Research golden journey", () => {
  test.use({ storageState: researchAnalystAuthStatePath });

  test("creates, confirms, executes, renders, and downloads a CSV", async ({ page }, testInfo) => {
    const title = `Golden ${testInfo.project.name}`;
    await page.goto(allowedListUrl);
    await expect(page.getByRole("heading", { level: 1, name: "Исследования" })).toBeVisible();
    await page.getByLabel("Название").fill(title);
    await page.getByLabel("Задача").fill("Provider-safe browser journey");
    await page.getByLabel("Поисковые запросы").fill("synthetic query one\nsynthetic query two");
    await page.getByRole("button", { name: "Создать" }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

    const createdUrl = new URL(page.url());
    const researchId = createdUrl.pathname.split("/").filter(Boolean).at(-1);
    if (!researchId) throw new Error("Created Research ID is missing from the detail URL");

    await page.getByRole("button", { name: "Рассчитать стоимость" }).click();
    await expect(page.getByRole("heading", { name: "Подтвердите платный запуск" })).toBeVisible();
    const estimateUrl = new URL(page.url());
    const runId = estimateUrl.searchParams.get("runId");
    if (!runId) throw new Error("Estimated run ID is missing from the confirmation URL");
    await expect(page.getByText(/2 запросов, оценка/u)).toBeVisible();
    await page.getByRole("button", { name: "Подтвердить" }).click();
    await expect(page.getByRole("status").filter({ hasText: "поставлено в очередь" })).toBeVisible();

    execFileSync(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "scripts/complete-e2e-research.ts",
        E2E_RESEARCH.allowedOrganizationId,
        E2E_RESEARCH.allowedProjectId,
        runId,
      ],
      { cwd: process.cwd(), env: { ...process.env, APP_ENV: "test" }, stdio: "pipe" },
    );
    await page.reload();
    const runHistory = (page.viewportSize()?.width ?? 0) < 768
      ? page.locator("#run-history article").first()
      : page.getByRole("table");
    await expect(runHistory.getByText("Завершено", { exact: true })).toBeVisible();
    await expect(page.getByText("1 всего", { exact: true })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Скачать CSV" }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    if (!downloadPath) throw new Error("Research CSV download did not produce a local artifact");
    const csv = readFileSync(downloadPath, "utf8");
    expect(csv).toContain('"query","status","allocated_cost_kopecks"');
    expect(csv).toContain("synthetic query one");
    expect(csv).toContain("competitor.example.invalid");

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });

  test("denies foreign Research and stale mutations", async ({ page }) => {
    await page.goto(detailUrl(
      E2E_RESEARCH.deniedResearchId,
      E2E_RESEARCH.deniedOrganizationId,
      E2E_RESEARCH.deniedProjectId,
    ));
    await expect(page.getByRole("heading", { level: 1, name: "Страница не существует" })).toBeVisible();

    await page.goto(detailUrl(
      E2E_RESEARCH.staleResearchId,
      E2E_RESEARCH.allowedOrganizationId,
      E2E_RESEARCH.allowedProjectId,
    ));
    await expect(page.getByRole("heading", { level: 1, name: "Stale research" })).toBeVisible();
    await page.locator('input[name="version"]').first().evaluate((input) => {
      (input as HTMLInputElement).value = "999";
    });
    await page.getByLabel("Название").fill("Must not be saved");
    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Не удалось открыть исследования")).toBeVisible();
    await page.goto(detailUrl(
      E2E_RESEARCH.staleResearchId,
      E2E_RESEARCH.allowedOrganizationId,
      E2E_RESEARCH.allowedProjectId,
    ));
    await expect(page.getByRole("heading", { level: 1, name: "Stale research" })).toBeVisible();
  });

  test("blocks budget excess and a user without a Tools grant", async ({ page }, testInfo) => {
    await page.goto(detailUrl(
      E2E_RESEARCH.budgetResearchId,
      E2E_RESEARCH.budgetOrganizationId,
      E2E_RESEARCH.budgetProjectId,
    ));
    await page.getByRole("button", { name: "Рассчитать стоимость" }).click();
    await expect(page.getByRole("heading", { name: "Дневной лимит исчерпан" })).toBeVisible();

    const usernameByProject: Record<string, string> = {
      "mobile-375": "e2e.client.mobile",
      "tablet-768": "e2e.client.tablet",
      "desktop-1280": "e2e.client.desktop1280",
      "desktop-1440": "e2e.client.desktop1440",
    };
    await signIn(page, testInfo, usernameByProject[testInfo.project.name]!);
    await page.goto(allowedListUrl);
    await expect(page.getByRole("heading", { level: 1, name: "Страница не существует" })).toBeVisible();
  });
});

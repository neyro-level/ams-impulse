import { expect, test } from "@playwright/test";
import { signIn } from "./sign-in.ts";

const syntheticAlphaProjectName = "Synthetic Alpha Organization";

test("preserves the public AMS IMPULSE surface", async ({ page, request }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Продвижение сайтов в Яндексе с контролем позиций");
  await expect(
    page.getByRole("heading", { level: 1, name: "Продвижение в Яндексе с контролем позиций" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /обсудить продвижение/i }).first()).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();

  const loginTrigger = page.getByRole("button", { name: /вход в личный кабинет|войти/i });
  await loginTrigger.focus();
  await expect(loginTrigger).toBeFocused();
  expect(await loginTrigger.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
  await loginTrigger.click();
  const loginDialog = page.getByRole("dialog", { name: "Вход в кабинет" });
  await expect(loginDialog).toBeVisible();
  await expect(page.getByLabel("Логин")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(loginDialog).toBeHidden();
  await expect(loginTrigger).toBeFocused();

  const faviconResponse = await request.get("/ams-favicon.svg");
  expect(faviconResponse.status()).toBe(200);
  expect(faviconResponse.headers()["content-type"]).toContain("image/svg+xml");

  const healthResponse = await request.get("/api/health/live");
  expect(healthResponse.status()).toBe(200);
  const health = (await healthResponse.json()) as {
    status: string;
    releaseSha: string | null;
    correlationId: string;
  };
  expect(health).toMatchObject({ status: "ok", releaseSha: null });
  expect(health.correlationId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(healthResponse.headers()["x-correlation-id"]).toBe(health.correlationId);

  const authResponse = await request.get("/api/auth/get-session");
  expect(authResponse.status()).toBe(200);
  expect(await authResponse.json()).toBeNull();

  for (const removedPath of ["/setup/", "/onboarding/password/", "/onboarding/two-factor/"]) {
    const removedResponse = await request.get(removedPath);
    expect(removedResponse.status()).toBe(404);
  }

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("keeps private routes behind the login boundary", async ({ page }) => {
  await page.goto("/analyst/");

  await expect(page).toHaveURL(/\?login=1$/);
  await expect(page.getByRole("dialog", { name: "Вход в кабинет" })).toBeVisible();
  await expect(page.getByLabel("Логин")).toBeVisible();
  await expect(page.getByLabel("Пароль")).toBeVisible();
});

test("opens the cabinet immediately after the first login", async ({ page }, testInfo) => {
  const usernameByProject: Record<string, string> = {
    "mobile-375": "e2e.client.mobile",
    "tablet-768": "e2e.client.tablet",
    "desktop-1280": "e2e.client.desktop1280",
    "desktop-1440": "e2e.client.desktop1440",
  };
  const username = usernameByProject[testInfo.project.name];
  if (!username) throw new Error(`Missing client identity for ${testInfo.project.name}`);

  await signIn(page, testInfo, username);
});

test.describe("Platform Admin", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await signIn(page, testInfo, "e2e.platform.admin");
  });

  test("opens for a platform administrator", async ({ page }) => {
    await page.goto("/admin/organizations/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Организации" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Разделы администрирования" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Хлебные крошки" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Создать организацию" })).toBeVisible();
    await expect(page.getByText(/Страница 1 из/i)).toBeVisible();

    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      await expect(page.getByText("Супер админ", { exact: true })).toBeVisible();
      await expect(page.locator("aside")).toHaveCSS("width", "232px");
      const collapseWidget = page.getByRole("button", { name: "Свернуть боковое меню" });
      await expect(collapseWidget).toBeVisible();
      await collapseWidget.click();
      await expect(page.locator("aside")).toHaveCSS("width", "76px");
      const expandWidget = page.getByRole("button", { name: "Развернуть боковое меню" });
      await expect(expandWidget).toBeVisible();
      await expandWidget.click();
      await expect(page.locator("aside")).toHaveCSS("width", "232px");
    } else {
      const drawerTrigger = page.getByRole("button", { name: "Открыть навигацию" });
      await drawerTrigger.click();
      const drawer = page.locator("#mobile-report-nav");
      await expect(drawer).toBeVisible();
      expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
      await expect(drawerTrigger).toBeFocused();
    }

    await page.goto("/admin/providers/");
    await expect(page.getByRole("heading", { level: 1, name: "Подключения источников" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Сайт*" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Источник*" })).toBeVisible();
    await expect(page.getByLabel("Дополнительные настройки").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Создать подключение" })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });

  test("does not expose private content from history or offline cache after logout", async ({ page, context }) => {
    await page.goto("/");
    await page.goto("/admin/organizations/");
    await expect(page.getByRole("heading", { level: 1, name: "Организации" })).toBeVisible();
    await page.getByRole("button", { name: "Выйти из кабинета" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Организации" })).toHaveCount(0);

    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "Организации" })).toHaveCount(0);

    const cachedPaths = await page.evaluate(async () => {
      const requests = await Promise.all((await caches.keys()).map(async (name) => (await caches.open(name)).keys()));
      return requests.flat().map((request) => new URL(request.url).pathname);
    });
    expect(cachedPaths.every((path) => path.startsWith("/_next/static/") || ["/ams-favicon.svg", "/pwa-icon-192.png", "/pwa-icon-512.png"].includes(path))).toBe(true);

    await context.setOffline(true);
    await expect(page.goto("/admin/organizations/", { waitUntil: "domcontentloaded" })).rejects.toThrow();
    await expect(page.getByRole("heading", { level: 1, name: "Организации" })).toHaveCount(0);
    await context.setOffline(false);
  });

  test("renders the Project reference slice with URL-owned filters", async ({ page }) => {
    await page.goto("/admin/projects/");
    await expect(page.getByRole("heading", { level: 1, name: "Проекты" })).toBeVisible();
    const createProjectTrigger = page.getByRole("button", { name: "Создать проект" });
    await expect(createProjectTrigger).toBeVisible();
    await createProjectTrigger.click();
    await expect(page.getByLabel("Организация")).toBeVisible();
    await page.getByRole("button", { name: "Создать", exact: true }).click();
    const invalidName = page.locator("#project-create-name");
    await expect(invalidName).toHaveAttribute("aria-invalid", "true");
    const errorId = await invalidName.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    await expect(page.locator(`#${errorId}`)).toBeVisible();
    await page.getByLabel("Поиск").fill("alpha");
    await page.getByRole("button", { name: "Применить" }).click();
    await expect(page).toHaveURL(/search=alpha/);

    if ((page.viewportSize()?.width ?? 0) < 768) {
      const projectCard = page.locator("article").first();
      await expect(projectCard).toBeVisible();
      await expect(
        projectCard.getByRole("heading", { name: syntheticAlphaProjectName }),
      ).toBeVisible();
    } else {
      const projectTable = page.getByRole("table");
      await expect(projectTable).toBeVisible();
      await expect(
        projectTable.getByText(syntheticAlphaProjectName, { exact: true }).first(),
      ).toBeVisible();
      await projectTable.getByRole("link", { name: "Проект", exact: true }).click();
      await expect(page).toHaveURL(/sort=name/);
    }

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});

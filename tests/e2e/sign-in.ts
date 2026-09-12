import { expect, type Page, type TestInfo } from "@playwright/test";

const projectIpBase: Record<string, number> = {
  setup: 10,
  "mobile-375": 40,
  "tablet-768": 80,
  "desktop-1280": 120,
  "desktop-1440": 160,
};

function testIp(testInfo: TestInfo) {
  const titleOffset = [...testInfo.title].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 30;
  return `192.0.2.${(projectIpBase[testInfo.project.name] ?? 200) + titleOffset}`;
}

export async function signIn(page: Page, testInfo: TestInfo, username: string) {
  await page.context().clearCookies();
  await page.setExtraHTTPHeaders({ "x-real-ip": testIp(testInfo) });
  await page.goto("/?login=1");
  await page.getByLabel("Логин").fill(username);
  await page.getByLabel("Пароль").fill("E2e!2026");
  await page
    .getByRole("dialog", { name: "Вход в кабинет" })
    .getByRole("button", { name: "Войти", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/?$/, { timeout: 15_000 });
}

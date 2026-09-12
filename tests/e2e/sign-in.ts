import { expect, type Page, type TestInfo } from "@playwright/test";
import { createOTP } from "@better-auth/utils/otp";
import { E2E_PLATFORM_ADMIN_TOTP_SECRET } from "../../scripts/e2e-auth-contract.ts";

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
  if (username === "e2e.platform.admin") {
    await expect(page.getByRole("heading", { name: "Подтвердите вход" })).toBeVisible();
    const code = await createOTP(E2E_PLATFORM_ADMIN_TOTP_SECRET, { digits: 6, period: 30 }).totp();
    await page.getByLabel("Код из приложения").fill(code);
    await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  }
  const expectedLanding = username === "e2e.research.analyst"
    ? /\/tools\/research(?:\/|\?)/
    : /\/dashboard\/?$/;
  await expect(page).toHaveURL(expectedLanding, { timeout: 15_000 });
}

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { test as setup } from "@playwright/test";
import { E2E_RESEARCH } from "../../scripts/e2e-research-contract.ts";
import { researchAnalystAuthStatePath } from "./auth-state.ts";
import { signIn } from "./sign-in.ts";

setup("authenticate Research analyst", async ({ page }, testInfo) => {
  await signIn(page, testInfo, E2E_RESEARCH.analystUsername);
  await mkdir(path.dirname(researchAnalystAuthStatePath), { recursive: true });
  await page.context().storageState({ path: researchAnalystAuthStatePath });
});

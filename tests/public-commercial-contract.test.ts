import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("public commercial contract", () => {
  async function readLandingContract() {
    const files = [
      "src/components/marketing/ImpulseLanding.tsx",
      "src/components/marketing/sections/HeroSection.tsx",
    ];
    return (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
  }

  it("does not present signup, a guaranteed ranking or an automatic trial", async () => {
    const landing = await readLandingContract();
    const dialog = await readFile("src/components/marketing/LeadRequestDialog.tsx", "utf8");
    const publicCopy = `${landing}\n${dialog}`.toLowerCase();

    expect(publicCopy).not.toMatch(/топ-1(?!0)/u);
    expect(publicCopy).not.toContain("уникальные технологии");
    expect(publicCopy).not.toContain("бесплатный тест-драйв");
    expect(publicCopy).not.toContain("регистрируйся");
    expect(publicCopy).toContain("обсудить архитектуру");
    expect(publicCopy).toContain("проектируем системы продаж и маркетинга");
  });

  it("keeps the temporary landing composition to header, hero and footer", async () => {
    const composition = await readFile("src/components/marketing/ImpulseLanding.tsx", "utf8");

    expect(composition).toContain("<HeroSection");
    expect(composition).toContain("<SiteFooter");
    expect(composition).not.toContain("ServiceMechanismSection");
    expect(composition).not.toContain("ReportProofSection");
  });
});

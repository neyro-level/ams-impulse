import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("public commercial contract", () => {
  async function readLandingContract() {
    const files = [
      "src/components/marketing/ImpulseLanding.tsx",
      "src/components/marketing/sections/HeroSection.tsx",
      "src/components/marketing/sections/ServiceMechanismSection.tsx",
      "src/components/marketing/sections/ReportProofSection.tsx",
      "src/components/marketing/sections/content.ts",
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
    expect(publicCopy).toContain("обсудить продвижение");
  });

  it("describes proof as product capability rather than client results", async () => {
    const landing = await readLandingContract();
    expect(landing).toContain("без демонстрационных результатов и обещаний позиции");
    expect(landing).toContain("всё утверждённое активное ядро");
  });
});

import path from "node:path";

export const adminAuthStatePath = path.join(process.cwd(), "test-results", ".auth", "admin.json");
export const researchAnalystAuthStatePath = path.join(
  process.cwd(),
  "test-results",
  ".auth",
  "research-analyst.json",
);

import { describe, expect, it } from "vitest";
import { ConfiguredResearchBudgetPolicy, ConfiguredResearchPricing } from "../src/modules/research/server.ts";

describe("configured Research money policy", () => {
  it("reads pricing and budget limits from mandatory server configuration", () => {
    const pricing = ConfiguredResearchPricing.fromEnvironment({ RESEARCH_QUERY_ESTIMATE_KOPECKS: "125" });
    const budget = ConfiguredResearchBudgetPolicy.fromEnvironment({
      RESEARCH_DAILY_LIMIT_KOPECKS: "50000",
      RESEARCH_MONTHLY_LIMIT_KOPECKS: "300000",
    });

    expect(pricing.estimateRunCostKopecks(3)).toBe(375);
    expect(budget).toMatchObject({ dailyLimitKopecks: 50_000, monthlyLimitKopecks: 300_000 });
  });

  it("fails closed when pricing configuration is absent or invalid", () => {
    expect(() => ConfiguredResearchPricing.fromEnvironment({})).toThrowError(expect.objectContaining({ code: "RESEARCH_PRICING_UNAVAILABLE" }));
    expect(() => ConfiguredResearchPricing.fromEnvironment({ RESEARCH_QUERY_ESTIMATE_KOPECKS: "12.5" })).toThrowError(expect.objectContaining({ code: "RESEARCH_PRICING_UNAVAILABLE" }));
  });

  it("rejects absent or inconsistent budget limits", () => {
    expect(() => ConfiguredResearchBudgetPolicy.fromEnvironment({})).toThrow("RESEARCH_BUDGET_CONFIGURATION_INVALID");
    expect(() => ConfiguredResearchBudgetPolicy.fromEnvironment({ RESEARCH_DAILY_LIMIT_KOPECKS: "50000", RESEARCH_MONTHLY_LIMIT_KOPECKS: "40000" })).toThrow("RESEARCH_BUDGET_CONFIGURATION_INVALID");
  });
});

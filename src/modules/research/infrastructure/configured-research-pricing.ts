import { ResearchError } from "../domain/research.ts";
import type { ResearchBudgetPolicy, ResearchPricingPolicy } from "../application/ports/research-money-policy.ts";

function requiredKopecks(env: Record<string, string | undefined>, name: string, errorCode: string) {
  const raw = env[name]?.trim();
  if (!raw) throw new Error(errorCode);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(errorCode);
  return value;
}

export class ConfiguredResearchBudgetPolicy implements ResearchBudgetPolicy {
  private constructor(
    public readonly dailyLimitKopecks: number,
    public readonly monthlyLimitKopecks: number,
  ) {}

  static fromEnvironment(env: Record<string, string | undefined> = process.env) {
    const daily = requiredKopecks(env, "RESEARCH_DAILY_LIMIT_KOPECKS", "RESEARCH_BUDGET_CONFIGURATION_INVALID");
    const monthly = requiredKopecks(env, "RESEARCH_MONTHLY_LIMIT_KOPECKS", "RESEARCH_BUDGET_CONFIGURATION_INVALID");
    if (monthly < daily) throw new Error("RESEARCH_BUDGET_CONFIGURATION_INVALID");
    return new ConfiguredResearchBudgetPolicy(daily, monthly);
  }
}

export class ConfiguredResearchPricing implements ResearchPricingPolicy {
  private constructor(private readonly queryAllocationKopecks: number) {}

  static fromEnvironment(env: Record<string, string | undefined> = process.env) {
    const raw = env.RESEARCH_QUERY_ESTIMATE_KOPECKS?.trim();
    if (!raw) throw new ResearchError("RESEARCH_PRICING_UNAVAILABLE");
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 0) throw new ResearchError("RESEARCH_PRICING_UNAVAILABLE");
    return new ConfiguredResearchPricing(value);
  }

  estimateRunCostKopecks(queryCount: number) {
    return this.queryAllocationKopecks * queryCount;
  }
}

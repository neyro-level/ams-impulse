export interface ResearchBudgetPolicy {
  readonly dailyLimitKopecks: number;
  readonly monthlyLimitKopecks: number;
}

export interface ResearchPricingPolicy {
  estimateRunCostKopecks(queryCount: number): number;
}

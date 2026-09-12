import { describe, expect, it } from "vitest";
import {
  deriveResearchCsvIdempotencyKey,
  deriveResearchEstimateIdempotencyKey,
} from "../src/modules/research/domain/research-idempotency.ts";

describe("Research idempotency keys", () => {
  it("normalizes equivalent estimate inputs", () => {
    const first = deriveResearchEstimateIdempotencyKey({
      researchId: "research-1",
      version: 3,
      queries: ["  Купить   квартиру ", "ЦЕНЫ"],
    });
    const repeated = deriveResearchEstimateIdempotencyKey({
      researchId: "research-1",
      version: 3,
      queries: ["купить квартиру", "цены"],
    });
    expect(first).toBe(repeated);
    expect(first).toMatch(/^estimate:v1:[a-f0-9]{64}$/);
  });

  it("changes estimate keys with version or normalized query input", () => {
    const baseline = deriveResearchEstimateIdempotencyKey({ researchId: "research-1", version: 1, queries: ["alpha"] });
    expect(deriveResearchEstimateIdempotencyKey({ researchId: "research-1", version: 2, queries: ["alpha"] })).not.toBe(baseline);
    expect(deriveResearchEstimateIdempotencyKey({ researchId: "research-1", version: 1, queries: ["beta"] })).not.toBe(baseline);
  });

  it("derives a stable versioned CSV key from the run", () => {
    expect(deriveResearchCsvIdempotencyKey("run-1")).toBe(deriveResearchCsvIdempotencyKey("run-1"));
    expect(deriveResearchCsvIdempotencyKey("run-1")).not.toBe(deriveResearchCsvIdempotencyKey("run-2"));
  });
});

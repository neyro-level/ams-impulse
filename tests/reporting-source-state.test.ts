import { describe, expect, it } from "vitest";
import { getSourceBusinessState } from "../src/modules/reporting/presentation/source-business-state.ts";

describe("reporting source business states", () => {
  it.each(["partial", "failed", "not_configured", "access_denied", "quota_limited", "stale"] as const)(
    "explains %s without exposing provider details",
    (status) => {
      const state = getSourceBusinessState(status);

      expect(state.label.length).toBeGreaterThan(0);
      expect(state.meaning.length).toBeGreaterThan(0);
      expect(state.action?.length).toBeGreaterThan(0);
      expect(`${state.meaning} ${state.action}`).not.toMatch(/payload|token|credential|safeErrorCode/i);
    },
  );

  it("does not demand an action for a successful source", () => {
    expect(getSourceBusinessState("success").action).toBeNull();
  });
});

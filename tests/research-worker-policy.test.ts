import { describe, expect, it } from "vitest";

import {
  RESEARCH_HEARTBEAT_STALE_MS,
  RESEARCH_HEARTBEAT_WRITE_INTERVAL_MS,
  RESEARCH_JOB_EXPIRE_IN_SECONDS,
  RESEARCH_JOB_RETRY_DELAY_SECONDS,
  RESEARCH_JOB_RETRY_LIMIT,
  RESEARCH_STALE_RUN_AFTER_MS,
} from "../src/platform/workers/timing-policy.ts";

describe("research worker timing policy", () => {
  it("allows missed heartbeat writes without reporting a healthy dead worker", () => {
    expect(RESEARCH_HEARTBEAT_STALE_MS).toBe(RESEARCH_HEARTBEAT_WRITE_INTERVAL_MS * 3);
  });

  it("settles an expired job before stale-run recovery and never auto-retries paid work", () => {
    expect(RESEARCH_STALE_RUN_AFTER_MS).toBeGreaterThan(RESEARCH_JOB_EXPIRE_IN_SECONDS * 1_000);
    expect(RESEARCH_JOB_RETRY_LIMIT).toBe(0);
    expect(RESEARCH_JOB_RETRY_DELAY_SECONDS).toBe(0);
  });
});

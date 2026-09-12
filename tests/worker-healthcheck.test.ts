import { describe, expect, it } from "vitest";

import { isHeartbeatFresh, WORKER_HEALTH_MAX_AGE_MS } from "../src/worker/healthcheck.ts";

describe("worker heartbeat health", () => {
  const now = new Date("2026-09-12T12:00:00.000Z");

  it("accepts a current heartbeat", () => {
    expect(isHeartbeatFresh(new Date(now.getTime() - WORKER_HEALTH_MAX_AGE_MS), now)).toBe(true);
  });

  it("rejects stale and future heartbeats", () => {
    expect(isHeartbeatFresh(new Date(now.getTime() - WORKER_HEALTH_MAX_AGE_MS - 1), now)).toBe(false);
    expect(isHeartbeatFresh(new Date(now.getTime() + 1), now)).toBe(false);
  });
});

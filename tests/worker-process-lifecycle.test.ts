import { describe, expect, it, vi } from "vitest";
import { runWorkerProcess } from "../src/worker/process-lifecycle.ts";

describe("runWorkerProcess", () => {
  it("closes shared database resources after a successful one-shot command", async () => {
    const events: string[] = [];
    const close = vi.fn(async () => {
      events.push("close");
    });

    await runWorkerProcess(async () => {
      events.push("run");
    }, close);

    expect(events).toEqual(["run", "close"]);
    expect(close).toHaveBeenCalledOnce();
  });

  it("closes shared database resources when a command fails", async () => {
    const failure = new Error("command failed");
    const close = vi.fn(async () => undefined);

    await expect(runWorkerProcess(async () => {
      throw failure;
    }, close)).rejects.toBe(failure);

    expect(close).toHaveBeenCalledOnce();
  });

  it("surfaces cleanup failures instead of leaving a successful process hanging", async () => {
    const cleanupFailure = new Error("cleanup failed");

    await expect(runWorkerProcess(
      async () => undefined,
      async () => {
        throw cleanupFailure;
      },
    )).rejects.toBe(cleanupFailure);
  });
});

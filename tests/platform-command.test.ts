import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { DatabaseTransaction } from "../src/platform/database/transaction.ts";

const runInDatabaseTransaction = vi.hoisted(() =>
  vi.fn(async (_context, execute: (transaction: DatabaseTransaction) => Promise<unknown>) =>
    execute({} as DatabaseTransaction),
  ),
);

vi.mock("../src/platform/database/transaction.ts", () => ({ runInDatabaseTransaction }));

import { defineCommand } from "../src/platform/commands/define-command.ts";

const principal = {
  kind: "platform-admin" as const,
  userId: "admin-1",
  correlationId: "00000000-0000-4000-8000-000000000001",
};

describe("defineCommand", () => {
  it("validates and authorizes before opening the database transaction", async () => {
    const authorize = vi.fn(() => {
      throw new Error("ACCESS_DENIED");
    });
    const execute = vi.fn();
    const command = defineCommand({
      name: "test.command",
      input: z.object({ value: z.string().min(1) }),
      authorize,
      execute,
    });

    await expect(command(principal, { value: "" })).rejects.toBeInstanceOf(z.ZodError);
    expect(authorize).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();

    await expect(command(principal, { value: "valid" })).rejects.toThrow("ACCESS_DENIED");
    expect(authorize).toHaveBeenCalledOnce();
    expect(execute).not.toHaveBeenCalled();
    expect(runInDatabaseTransaction).not.toHaveBeenCalled();
  });

  it("derives the database context from the principal, never from command input", async () => {
    const execute = vi.fn(async () => "done");
    const command = defineCommand({
      name: "test.command",
      input: z.object({ userId: z.string(), organizationId: z.string() }),
      authorize: vi.fn(),
      execute,
    });

    await expect(
      command(principal, { userId: "forged", organizationId: "forged" }),
    ).resolves.toBe("done");
    expect(runInDatabaseTransaction).toHaveBeenLastCalledWith(
      { kind: "platform-admin", userId: principal.userId },
      expect.any(Function),
    );
    expect(execute).toHaveBeenCalledOnce();
  });

  it("logs correlated success and failure without command input or identity", async () => {
    const events: Array<Record<string, string | number>> = [];
    let clock = 10;
    const observability = {
      now: () => (clock += 5),
      log: (event: Record<string, string | number>) => events.push(event),
      runInTransaction: async <TResult>(
        _context: unknown,
        execute: (transaction: DatabaseTransaction) => Promise<TResult>,
      ) => execute({} as DatabaseTransaction),
    };
    const failedCommand = defineCommand({
      name: "test.observed",
      input: z.object({ secretInput: z.string() }),
      authorize: () => { throw Object.assign(new Error("denied"), { code: "ACCESS_DENIED" }); },
      execute: async () => ({ ok: true }),
    }, observability);
    const successfulCommand = defineCommand({
      name: "test.success",
      input: z.object({ value: z.string() }),
      authorize: () => undefined,
      execute: async () => ({ ok: true }),
    }, observability);

    await expect(failedCommand({
      kind: "tenant-user",
      userId: "must-not-log",
      organizationId: "organization-1",
      membershipId: "membership-1",
      role: "VIEWER",
      correlationId: "correlation-1",
    }, { secretInput: "must-not-log" })).rejects.toThrow("denied");
    await expect(successfulCommand({ kind: "platform-admin", userId: "must-not-log", correlationId: "correlation-2" }, { value: "must-not-log" })).resolves.toEqual({ ok: true });
    expect(events).toEqual([{
      event: "command_finished",
      name: "test.observed",
      durationMs: 5,
      outcome: "failure",
      code: "ACCESS_DENIED",
      correlationId: "correlation-1",
      principalKind: "tenant-user",
    }, {
      event: "command_finished",
      name: "test.success",
      durationMs: 5,
      outcome: "success",
      correlationId: "correlation-2",
      principalKind: "platform-admin",
    }]);
    expect(JSON.stringify(events)).not.toContain("must-not-log");
  });
});

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
});

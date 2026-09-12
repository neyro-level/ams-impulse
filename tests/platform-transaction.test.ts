import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const executeRaw = vi.fn();
  const transaction = { $executeRaw: executeRaw };
  const openTransaction = vi.fn(
    async (execute: (databaseTransaction: { $executeRaw: typeof executeRaw }) => Promise<unknown>) =>
      execute(transaction),
  );
  return { executeRaw, transaction, openTransaction };
});

vi.mock("../src/platform/database/prisma/client.ts", () => ({
  getPrismaClient: () => ({ $transaction: state.openTransaction }),
}));

import { runInDatabaseTransaction } from "../src/platform/database/transaction.ts";

describe("runInDatabaseTransaction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets the local RLS context before application execution", async () => {
    const order: string[] = [];
    state.executeRaw.mockImplementation(async () => {
      order.push("context");
      return 1;
    });

    await runInDatabaseTransaction(
      { kind: "platform-admin", userId: "admin-1" },
      async () => {
        order.push("execute");
        return "done";
      },
    );

    expect(order).toEqual(["context", "execute"]);
    expect(state.executeRaw).toHaveBeenCalledOnce();
  });
});

import {
  setDatabaseAuthorizationContext,
  type DatabaseAuthorizationContext,
} from "./authorization-context.ts";
import { getPrismaClient } from "./prisma/client.ts";
export type { DatabaseTransaction } from "./transaction-types.ts";
import type { DatabaseTransaction } from "./transaction-types.ts";

export async function runInDatabaseTransaction<TResult>(
  context: DatabaseAuthorizationContext,
  execute: (transaction: DatabaseTransaction) => Promise<TResult>,
): Promise<TResult> {
  return getPrismaClient().$transaction(async (transaction) => {
    await setDatabaseAuthorizationContext(transaction, context);
    return execute(transaction);
  });
}

import { z } from "zod";
import type { PrincipalContext } from "../authorization/principal.ts";
import { deriveDatabaseAuthorizationContext } from "../database/authorization-context.ts";
import {
  runInDatabaseTransaction,
  type DatabaseTransaction,
} from "../database/transaction.ts";
import { getLogger } from "../observability/logger.ts";

export interface CommandExecution<TPrincipal, TInput> {
  principal: TPrincipal;
  input: TInput;
  transaction: DatabaseTransaction;
}

export interface CommandDefinition<TPrincipal, TSchema extends z.ZodType, TResult> {
  name: string;
  input: TSchema;
  authorize: (principal: TPrincipal, input: z.output<TSchema>) => Promise<void> | void;
  execute: (
    execution: CommandExecution<TPrincipal, z.output<TSchema>>,
  ) => Promise<TResult>;
}

export interface CommandObservabilityDependencies {
  now(): number;
  log(event: Record<string, string | number>): void;
  runInTransaction<TResult>(
    context: ReturnType<typeof deriveDatabaseAuthorizationContext>,
    execute: (transaction: DatabaseTransaction) => Promise<TResult>,
  ): Promise<TResult>;
}

const defaultObservability: CommandObservabilityDependencies = {
  now: () => performance.now(),
  log: (event) => getLogger({ component: "command" }).info(event, "command_finished"),
  runInTransaction: runInDatabaseTransaction,
};

function stringProperty(value: unknown, property: string, fallback: string) {
  return value && typeof value === "object" && property in value && typeof value[property as keyof typeof value] === "string"
    ? value[property as keyof typeof value] as string
    : fallback;
}

export function defineCommand<TPrincipal extends PrincipalContext, TSchema extends z.ZodType, TResult>(
  definition: CommandDefinition<TPrincipal, TSchema, TResult>,
  observability: CommandObservabilityDependencies = defaultObservability,
) {
  return async (principal: TPrincipal, rawInput: z.input<TSchema>): Promise<TResult> => {
    const startedAt = observability.now();
    const base = {
      event: "command_finished",
      name: definition.name,
      correlationId: stringProperty(principal, "correlationId", "missing"),
      principalKind: stringProperty(principal, "kind", "unknown"),
    };
    try {
      const input = definition.input.parse(rawInput);
      await definition.authorize(principal, input);
      const databaseContext = deriveDatabaseAuthorizationContext(principal);
      const result = await observability.runInTransaction(
        databaseContext,
        (transaction) => definition.execute({ principal, input, transaction }),
      );
      observability.log({ ...base, durationMs: Math.max(0, Math.round(observability.now() - startedAt)), outcome: "success" });
      return result;
    } catch (error) {
      const code = stringProperty(error, "code", error instanceof z.ZodError ? "COMMAND_INPUT_INVALID" : "COMMAND_FAILED");
      observability.log({ ...base, durationMs: Math.max(0, Math.round(observability.now() - startedAt)), outcome: "failure", code });
      throw error;
    }
  };
}

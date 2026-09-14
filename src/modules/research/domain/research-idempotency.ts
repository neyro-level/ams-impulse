import { createHash } from "node:crypto";

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function normalizeQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
}

export function deriveResearchEstimateIdempotencyKey(input: {
  researchId: string;
  version: number;
  queries: readonly string[];
}): string {
  return `estimate:v1:${digest({
    researchId: input.researchId,
    version: input.version,
    queries: input.queries.map(normalizeQuery),
  })}`;
}

export function deriveResearchEstimateAttemptKey(requestKey: string, runId: string): string {
  return `${requestKey}:attempt:${runId}`;
}

export function deriveResearchCsvIdempotencyKey(runId: string): string {
  return `export:csv:v1:${digest({ runId, format: "csv", schemaVersion: 1 })}`;
}

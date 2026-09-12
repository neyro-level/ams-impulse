import { randomUUID } from "node:crypto";
import { z } from "zod";

export const correlationIdSchema = z.string().uuid();

export function createCorrelationId(): string {
  return randomUUID();
}

export function resolveCorrelationId(headers: Pick<Headers, "get">): string {
  const incoming = headers.get("x-correlation-id");
  const parsed = correlationIdSchema.safeParse(incoming);
  return parsed.success ? parsed.data : createCorrelationId();
}

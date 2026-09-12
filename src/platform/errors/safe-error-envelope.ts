import { z } from "zod";
import { correlationIdSchema } from "../http/correlation.ts";
import { normalizeStaleState } from "./stale-state.ts";

export const safeErrorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
    message: z.string().min(1).max(500),
    fieldErrors: z.record(z.string(), z.array(z.string())).default({}),
    correlationId: correlationIdSchema,
    latestVersion: z.number().int().positive().optional(),
  }),
});

export type SafeErrorEnvelope = z.infer<typeof safeErrorEnvelopeSchema>;
export type SafeErrorInput = Omit<SafeErrorEnvelope["error"], "fieldErrors"> & { fieldErrors?: Record<string, string[]> };

export function createSafeErrorEnvelope(input: SafeErrorInput, cause?: unknown): SafeErrorEnvelope {
  const normalized = normalizeStaleState(input, cause);
  return safeErrorEnvelopeSchema.parse({ ok: false, error: { ...normalized, fieldErrors: normalized.fieldErrors ?? {} } });
}

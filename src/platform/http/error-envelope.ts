import { NextResponse } from "next/server";
import { createSafeErrorEnvelope, safeErrorEnvelopeSchema, type SafeErrorEnvelope } from "../errors/safe-error-envelope.ts";

export const publicErrorEnvelopeSchema = safeErrorEnvelopeSchema;
export type PublicErrorEnvelope = SafeErrorEnvelope;

export interface PublicErrorInput {
  code: string;
  message: string;
  correlationId: string;
  fieldErrors?: Record<string, string[]>;
  latestVersion?: number;
}

export function createPublicErrorEnvelope(input: PublicErrorInput): PublicErrorEnvelope {
  return createSafeErrorEnvelope(input);
}

export function createPublicErrorResponse(input: PublicErrorInput, status: number) {
  return NextResponse.json(createPublicErrorEnvelope(input), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Correlation-ID": input.correlationId,
    },
  });
}

import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";

import { createLogger } from "../src/platform/observability/logger.ts";

describe("Research operational log safety", () => {
  it("redacts provider URLs, signed URLs, raw query and request body PII", () => {
    let output = "";
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createLogger({ scope: "research-proof" }, destination);
    logger.info({
      providerUrl: "https://provider.invalid/?key=provider-secret",
      signedUrl: "https://storage.invalid/object?signature=signed-secret",
      rawQuery: "private@example.invalid sensitive phrase",
      payload: {
        query: "private@example.invalid sensitive phrase",
        queries: ["private@example.invalid"],
        body: { email: "private@example.invalid" },
        rawBody: "phone=+70000000000",
        providerUrl: "https://provider.invalid/?key=nested-secret",
        signedUrl: "https://storage.invalid/object?signature=nested-signed-secret",
        researchId: "safe-research-id",
      },
    }, "research redaction proof");

    for (const forbidden of [
      "provider-secret",
      "signed-secret",
      "nested-secret",
      "nested-signed-secret",
      "private@example.invalid",
      "+70000000000",
    ]) {
      expect(output).not.toContain(forbidden);
    }
    const record = JSON.parse(output) as Record<string, unknown>;
    expect(record).toMatchObject({
      providerUrl: "[REDACTED]",
      signedUrl: "[REDACTED]",
      rawQuery: "[REDACTED]",
      payload: {
        query: "[REDACTED]",
        queries: "[REDACTED]",
        body: "[REDACTED]",
        researchId: "safe-research-id",
      },
    });
  });
});

import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "../src/platform/observability/logger.ts";

function captureLogger(bindings: Record<string, string> = { scope: "test" }) {
  let output = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  return {
    logger: createLogger(bindings, stream),
    read() {
      return output.trim();
    },
  };
}

describe("pino observability logger", () => {
  it("removes nested PII and secrets from the serialized log", () => {
    const { logger, read } = captureLogger();
    logger.info({
      password: "secret-value",
      authorization: "Bearer token",
      headers: {
        cookie: "sid=1",
        authorization: "Bearer inner",
        "x-api-key": "header-secret",
      },
      user: {
        id: "user-safe-id",
        email: "nested-user@example.test",
        phone: "+70000000001",
      },
      actor: { id: "actor-safe-id", email: "actor@example.test", token: "actor-token" },
      payload: {
        apiKey: "top-secret",
        email: "lead@example.test",
        phone: "+70000000002",
        headers: { authorization: "Bearer payload", cookie: "payload-cookie" },
        user: { email: "payload-user@example.test", password: "payload-password" },
        actor: { phone: "+70000000003", secret: "payload-actor-secret" },
        projectSlug: "alpha",
        nested: {
          contact: {
            email: "deep@example.test",
            phone: "+70000000004",
          },
        },
        query: "classified research phrase",
        providerBody: "raw-provider-response",
        downloadUrl: "https://storage.example.test/private/export.csv?X-Amz-Signature=secret-signature",
        credentialUrl: "https://private-user:private-password@provider.example.test/path#private-fragment",
        credentials: {
          accessToken: "nested-access-token",
          clientSecret: "nested-client-secret",
          databasePassword: "nested-database-password",
        },
      },
    }, "structured-test");

    const serialized = read();
    const payload = JSON.parse(serialized) as Record<string, unknown>;
    for (const forbidden of [
      "secret-value",
      "Bearer token",
      "sid=1",
      "Bearer inner",
      "header-secret",
      "nested-user@example.test",
      "+70000000001",
      "backup-secret",
      "actor@example.test",
      "actor-token",
      "top-secret",
      "lead@example.test",
      "+70000000002",
      "Bearer payload",
      "payload-cookie",
      "payload-user@example.test",
      "payload-password",
      "+70000000003",
      "payload-actor-secret",
      "deep@example.test",
      "+70000000004",
      "classified research phrase",
      "raw-provider-response",
      "secret-signature",
      "private-user",
      "private-password",
      "private-fragment",
      "nested-access-token",
      "nested-client-secret",
      "nested-database-password",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(payload.password).toBe("[REDACTED]");
    expect(payload.authorization).toBe("[REDACTED]");
    expect(payload.headers).toMatchObject({
      cookie: "[REDACTED]",
      authorization: "[REDACTED]",
    });
    expect(payload.payload).toMatchObject({
      apiKey: "[REDACTED]",
      projectSlug: "alpha",
      query: "[REDACTED]",
      providerBody: "[REDACTED]",
      downloadUrl: "https://storage.example.test/private/export.csv",
      credentialUrl: "https://provider.example.test/path",
      credentials: {
        accessToken: "[REDACTED]",
        clientSecret: "[REDACTED]",
        databasePassword: "[REDACTED]",
      },
    });
  });

  it("keeps only safe diagnostic fields from errors and bindings", () => {
    const { logger, read } = captureLogger({ scope: "test", accessToken: "binding-secret" });
    const error = Object.assign(new Error("provider body with unsafe@example.test"), {
      code: "PROVIDER_REJECTED",
    });

    logger.error({ err: error, occurredAt: new Date("2026-09-12T00:00:00.000Z") }, "failed");

    const serialized = read();
    const payload = JSON.parse(serialized) as Record<string, unknown>;
    expect(serialized).not.toContain("binding-secret");
    expect(serialized).not.toContain("unsafe@example.test");
    expect(payload).toMatchObject({
      accessToken: "[REDACTED]",
      err: { name: "Error", code: "PROVIDER_REJECTED" },
      occurredAt: "2026-09-12T00:00:00.000Z",
    });
  });
});

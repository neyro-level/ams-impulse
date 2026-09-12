import { describe, expect, it } from "vitest";

import { isApprovedPrivateStorageUrl } from "../src/modules/research/index.ts";
import { S3PrivateExportStorage } from "../src/modules/research/server.ts";

const baseEnvironment = {
  S3_BUCKET: "research-e2e",
  S3_REGION: "e2e",
  AWS_ACCESS_KEY_ID: "synthetic-access",
  AWS_SECRET_ACCESS_KEY: "synthetic-secret",
};

describe("Research private storage URL boundary", () => {
  it("accepts HTTPS and rejects malformed or external HTTP URLs", () => {
    expect(isApprovedPrivateStorageUrl("https://storage.example.invalid/object")).toBe(true);
    expect(isApprovedPrivateStorageUrl("not-a-url", true)).toBe(false);
    expect(isApprovedPrivateStorageUrl("http://storage.example.invalid/object", true)).toBe(false);
  });

  it("allows HTTP loopback only through the explicit test flag", () => {
    expect(isApprovedPrivateStorageUrl("http://127.0.0.1:3199/object")).toBe(false);
    expect(isApprovedPrivateStorageUrl("http://127.0.0.1:3199/object", true)).toBe(true);
    expect(() => S3PrivateExportStorage.fromEnvironment({
      ...baseEnvironment,
      APP_ENV: "production",
      S3_ENDPOINT: "http://127.0.0.1:3199",
    })).toThrow("S3_ENDPOINT_MUST_USE_HTTPS");
    expect(() => S3PrivateExportStorage.fromEnvironment({
      ...baseEnvironment,
      APP_ENV: "test",
      S3_ENDPOINT: "http://127.0.0.1:3199",
    })).not.toThrow();
  });
});

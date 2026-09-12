import { describe, expect, it } from "vitest";

import { newId } from "../src/platform/identifiers/new-id.ts";

describe("newId", () => {
  it("creates an RFC 9562 UUIDv7 carrying the supplied millisecond timestamp", () => {
    const timestamp = 1_725_000_123_456;
    const id = newId(timestamp);

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(Number.parseInt(id.replaceAll("-", "").slice(0, 12), 16)).toBe(timestamp);
  });

  it("rejects timestamps that cannot fit the UUIDv7 field", () => {
    expect(() => newId(-1)).toThrow(RangeError);
    expect(() => newId(Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
  });
});

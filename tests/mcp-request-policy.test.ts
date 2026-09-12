import { describe, expect, it } from "vitest";
import {
  getMcpSubjectRateWindow,
  isAllowedMcpBrowserRequest,
} from "../src/platform/auth/mcp-request-policy.ts";

const resource = "https://impulse.example.com/mcp";

describe("MCP request policy", () => {
  it("requires same-origin Fetch Metadata for browser-origin POST requests", () => {
    expect(isAllowedMcpBrowserRequest(new Request(resource, { method: "POST", headers: {
      origin: "https://impulse.example.com",
      "sec-fetch-site": "same-origin",
    } }), resource)).toBe(true);
    expect(isAllowedMcpBrowserRequest(new Request(resource, { method: "POST", headers: {
      origin: "https://impulse.example.com",
      "sec-fetch-site": "cross-site",
    } }), resource)).toBe(false);
    expect(isAllowedMcpBrowserRequest(new Request(resource, { method: "POST", headers: {
      origin: "https://attacker.example.net",
      "sec-fetch-site": "cross-site",
    } }), resource)).toBe(false);
  });

  it("does not require browser-only headers from native and server clients", () => {
    expect(isAllowedMcpBrowserRequest(new Request(resource, { method: "POST" }), resource)).toBe(true);
  });

  it("builds stable privacy-preserving subject windows", () => {
    const first = getMcpSubjectRateWindow("user-123", new Date("2026-09-12T10:00:15.000Z"));
    const second = getMcpSubjectRateWindow("user-123", new Date("2026-09-12T10:00:59.000Z"));
    expect(first.key).toBe(second.key);
    expect(first.subjectHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.key).not.toContain("user-123");
    expect(first.windowStartedAt.toISOString()).toBe("2026-09-12T10:00:00.000Z");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { responseFromNextConfig } from "./helpers/next-config-response.mjs";

const requiredDirectives = [
  "default-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "connect-src 'self'",
  "img-src 'self' data: blob:",
];

describe("application CSP", () => {
  it.each([
    ["/", "public"],
    ["/dashboard", "application"],
    ["/sw.js", "service-worker"],
  ] as const)("resolves the final response headers for %s", async (pathname, policy) => {
    const response = await responseFromNextConfig(pathname);
    const csp = response.headers.get("content-security-policy");
    const cspHeaders = [...response.headers].filter(([key]) => key === "content-security-policy");

    expect(csp).toBeTruthy();
    expect(cspHeaders).toHaveLength(1);
    expect(response.headers.get("permissions-policy")).toBe(
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    );
    expect(response.headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains",
    );

    if (policy === "public") {
      for (const directive of requiredDirectives) expect(csp).toContain(directive);
      expect(csp).toContain("connect-src 'self' https://ams24.ru");
      expect(response.headers.get("cache-control")).toBeNull();
    } else if (policy === "application") {
      for (const directive of requiredDirectives) expect(csp).toContain(directive);
      expect(csp).not.toContain("https://ams24.ru");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    } else {
      expect(csp).toBe("default-src 'self'; script-src 'self'");
      expect(response.headers.get("content-type")).toBe("application/javascript; charset=utf-8");
      expect(response.headers.get("cache-control")).toBe("no-cache, no-store, must-revalidate");
    }
  });

  it("keeps the documented framework-inline exception explicit", () => {
    const config = readFileSync("next.config.ts", "utf8");
    expect(config).toContain("'unsafe-inline'");
    expect(config).not.toContain("nonce-");
  });

  it("keeps Nginx from appending a second CSP", () => {
    const nginx = readFileSync("ops/nginx/ams-seo-monitor.conf", "utf8");
    expect(nginx).not.toContain("add_header Content-Security-Policy");
  });
});

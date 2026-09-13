import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
  it("enforces the private application baseline from Next", () => {
    const config = readFileSync("next.config.ts", "utf8");
    for (const directive of requiredDirectives) expect(config).toContain(directive);
    expect(config).toContain('source: "/:path*"');
    expect(config).toContain('{ key: "Content-Security-Policy", value: applicationCsp }');
    expect(config).toContain('{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }');
    expect(config).toContain('{ key: "X-Content-Type-Options", value: "nosniff" }');
    expect(config).toContain('{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }');
    expect(config).toContain('{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }');
    expect(config).toContain('{ key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }');
    expect(config).toContain("connect-src 'self' https://ams24.ru");
    expect(config).not.toContain("nonce-");
  });

  it("keeps the host Nginx policy aligned with the application", () => {
    const nginx = readFileSync("ops/nginx/ams-seo-monitor.conf", "utf8");
    for (const directive of requiredDirectives) expect(nginx).toContain(directive);
    expect(nginx.match(/add_header Content-Security-Policy/g)).toHaveLength(2);
  });
});

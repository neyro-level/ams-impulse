import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  createAuthRateLimitConfig,
  createTrustedProxyIpConfig,
} from "../src/platform/auth/security-config.ts";

describe("Better Auth rate-limit contract", () => {
  it("explicitly enables strict rules for the installed login endpoints", () => {
    const config = createAuthRateLimitConfig();

    expect(config.enabled).toBe(true);
    expect(config.storage).toBe("memory");
    expect(config.customRules).toMatchObject({
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-in/username": { window: 60, max: 5 },
    });
  });

  it("uses only the Nginx-overwritten client IP header from the loopback proxy", () => {
    expect(createTrustedProxyIpConfig()).toEqual({
      ipAddressHeaders: ["x-real-ip"],
      trustedProxies: ["127.0.0.1/32", "::1/128"],
      ipv6Subnet: 64,
    });
    const nginx = readFileSync("ops/nginx/ams-seo-monitor.conf", "utf8");
    expect(nginx).not.toContain("$proxy_add_x_forwarded_for");
    expect(nginx.match(/proxy_set_header X-Real-IP \$remote_addr;/g)).toHaveLength(2);
    expect(nginx.match(/proxy_set_header X-Forwarded-For \$remote_addr;/g)).toHaveLength(2);
  });
});

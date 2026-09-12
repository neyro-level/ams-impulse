const strictRule = (window: number, max: number) => ({ window, max });

export function createAuthRateLimitConfig() {
  return {
    enabled: true,
    window: 60,
    max: 100,
    storage: "memory" as const,
    customRules: {
      "/sign-in/email": strictRule(60, 5),
      "/sign-in/username": strictRule(60, 5),
    },
  };
}

export function createTrustedProxyIpConfig() {
  return {
    ipAddressHeaders: ["x-real-ip"],
    trustedProxies: ["127.0.0.1/32", "::1/128"],
    ipv6Subnet: 64,
  };
}

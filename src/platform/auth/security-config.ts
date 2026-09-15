const strictRule = (window: number, max: number) => ({ window, max });

export function createAuthRateLimitConfig() {
  return {
    enabled: true,
    window: 60,
    max: 100,
    storage: "database" as const,
    modelName: "rateLimit",
    customRules: {
      "/sign-in/email": strictRule(60, 5),
      "/sign-in/username": strictRule(60, 5),
      "/change-password": strictRule(300, 5),
      "/request-password-reset": strictRule(300, 3),
      "/reset-password": strictRule(300, 3),
      "/reset-password/**": strictRule(300, 3),
      "/two-factor/**": strictRule(300, 5),
      "/oauth2/token": strictRule(60, 10),
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

import type { NextConfig } from "next";

const applicationCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const publicLandingCsp = applicationCsp.replace(
  "connect-src 'self'",
  "connect-src 'self' https://ams24.ru",
);

const serviceWorkerCsp = "default-src 'self'; script-src 'self'";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  agentRules: false,
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/((?!sw\\.js$|$).*)",
        headers: [
          { key: "Content-Security-Policy", value: applicationCsp },
          ...securityHeaders,
        ],
      },
      {
        source: "/",
        headers: [
          { key: "Content-Security-Policy", value: publicLandingCsp },
          ...securityHeaders,
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: serviceWorkerCsp },
          ...securityHeaders,
        ],
      },
      {
        source: "/(api|mcp|tools|dashboard|analyst|admin|notifications|c|consent|demo)/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/.well-known/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;

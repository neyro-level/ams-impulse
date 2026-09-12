import "server-only";

import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { jwt, twoFactor, username } from "better-auth/plugins";
import { cimd } from "@better-auth/cimd";
import { mcp } from "@better-auth/mcp";
import {
  hasDatabaseConfiguration,
  readAuthEnvironment,
} from "../config/server-environment.ts";
import { getPrismaClient } from "../database/prisma/client.ts";
import {
  createAuthRateLimitConfig,
  createTrustedProxyIpConfig,
} from "./security-config.ts";
import {
  getMcpResource,
  isMcpClientMetadataUrlAllowed,
  MCP_CLIENT_METADATA_CACHE_TTL,
  MCP_SCOPE,
} from "./mcp-config.ts";
import { fetchApprovedMcpClientMetadataResource } from "./mcp-metadata-transport.ts";

const authEnvironment = readAuthEnvironment();

export function hasAuthConfiguration() {
  return authEnvironment !== null && hasDatabaseConfiguration();
}

export const auth =
  hasAuthConfiguration() && authEnvironment
    ? betterAuth({
        secret: authEnvironment.secret,
        baseURL: authEnvironment.baseUrl,
        trustedOrigins: [
          authEnvironment.baseUrl,
          ...(process.env.NODE_ENV === "production"
            ? []
            : ["http://127.0.0.1:3000", "http://localhost:3000"]),
        ],
        database: prismaAdapter(getPrismaClient(), {
          provider: "postgresql",
        }),
        emailAndPassword: {
          enabled: true,
          disableSignUp: true,
          minPasswordLength: 8,
          maxPasswordLength: 128,
        },
        rateLimit: createAuthRateLimitConfig(),
        advanced: {
          ipAddress: createTrustedProxyIpConfig(),
        },
        plugins: [
          jwt(),
          twoFactor({
            issuer: "AMS IMPULSE",
            skipVerificationOnEnable: false,
            accountLockout: {
              enabled: true,
              maxFailedAttempts: 5,
              durationSeconds: 900,
            },
          }),
          mcp({
            loginPage: "/",
            consentPage: "/consent",
            resource: getMcpResource(authEnvironment.baseUrl),
            resources: [{
              identifier: getMcpResource(authEnvironment.baseUrl),
              allowedScopes: [MCP_SCOPE],
              accessTokenTtl: 300,
            }],
            scopes: [MCP_SCOPE, "offline_access"],
            grantTypes: ["authorization_code", "refresh_token"],
            accessTokenExpiresIn: 300,
            allowDynamicClientRegistration: false,
            allowUnauthenticatedClientRegistration: false,
            clientRegistrationDefaultScopes: [MCP_SCOPE],
            clientRegistrationAllowedScopes: ["offline_access"],
          }),
          cimd({
            fetchClientMetadataResource: fetchApprovedMcpClientMetadataResource,
            metadataProfile: "mcp-2026-07-28",
            metadataRevalidationInterval: MCP_CLIENT_METADATA_CACHE_TTL,
            metadataFetchPolicy: {
              minimumFetchInterval: 5,
              maximumConcurrentFetches: 8,
              maximumConcurrentFetchesPerOrigin: 2,
              maximumFetchesPerMinute: 60,
              maximumFetchesPerOriginPerMinute: 10,
            },
            maxCacheEntries: 256,
            originBoundFields: [
              "post_logout_redirect_uris",
              "client_uri",
              "jwks_uri",
              "policy_uri",
              "tos_uri",
            ],
            isMetadataDocumentUrlAllowed: isMcpClientMetadataUrlAllowed,
          }),
          username({
            displayUsername: false,
            immutableUsername: true,
            minUsernameLength: 3,
            maxUsernameLength: 30,
          }),
        ],
      })
    : null;

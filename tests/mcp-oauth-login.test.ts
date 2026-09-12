import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isMcpClientMetadataUrlAllowed,
  isMcpOAuthLoginRequest,
} from "../src/platform/auth/mcp-config.ts";

const authSource = readFileSync(new URL("../src/platform/auth/auth.ts", import.meta.url), "utf8");

describe("MCP OAuth login routing", () => {
  it("uses a query-free login page for provider redirects", () => {
    expect(authSource).toContain('loginPage: "/"');
    expect(authSource).not.toContain('loginPage: "/?');
  });

  it("recognizes a signed authorization-code login request", () => {
    expect(isMcpOAuthLoginRequest({
      response_type: "code",
      client_id: "codex-client",
      sig: "signed-query",
      ba_iat: "1789140000000",
    })).toBe(true);
  });

  it.each([
    { response_type: "code", client_id: "codex-client", ba_iat: "1789140000000" },
    { response_type: "code", sig: "signed-query", ba_iat: "1789140000000" },
    { response_type: "token", client_id: "codex-client", sig: "signed-query", ba_iat: "1789140000000" },
    { login: "1" },
  ])("does not treat an incomplete or ordinary login as OAuth", (params) => {
    expect(isMcpOAuthLoginRequest(params)).toBe(false);
  });

  it("uses bounded CIMD discovery and closes unauthenticated DCR", () => {
    expect(authSource).toContain("allowDynamicClientRegistration: false");
    expect(authSource).toContain("allowUnauthenticatedClientRegistration: false");
    expect(authSource).toContain("metadataRevalidationInterval");
    expect(authSource).toContain("metadataFetchPolicy");
    expect(authSource).toContain("maxCacheEntries: 256");
  });

  it.each([
    "https://client.example.com/.well-known/oauth-client.json",
    "https://mcp-client.example.net/oauth/client-metadata",
  ])("accepts bounded public HTTPS metadata URLs", (url) => {
    expect(isMcpClientMetadataUrlAllowed(url)).toBe(true);
  });

  it.each([
    "http://client.example.com/oauth.json",
    "https://client.example.com/",
    "https://client.example.com:8443/oauth.json",
    "https://client.example.com/oauth.json?variant=1",
    "https://user:secret@client.example.com/oauth.json",
    "not-a-url",
  ])("rejects metadata URLs outside the application policy", (url) => {
    expect(isMcpClientMetadataUrlAllowed(url)).toBe(false);
  });
});

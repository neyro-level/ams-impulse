export const MCP_SCOPE = "mcp:research" as const;
export const MCP_CLIENT_METADATA_CACHE_TTL = "15m" as const;

type OAuthSearchParams = Record<string, string | string[] | undefined>;

export function isMcpOAuthLoginRequest(params: OAuthSearchParams) {
  return params.response_type === "code"
    && typeof params.client_id === "string"
    && typeof params.sig === "string"
    && typeof params.ba_iat === "string";
}

export function getMcpResource(baseUrl: string) {
  return `${new URL(baseUrl).origin}/mcp`;
}

export function getConfiguredMcpResource(fallbackUrl?: string) {
  const baseUrl = process.env.BETTER_AUTH_URL?.trim() || fallbackUrl;
  if (!baseUrl) throw new Error("BETTER_AUTH_URL_REQUIRED");
  return getMcpResource(baseUrl);
}

export function isMcpClientMetadataUrlAllowed(clientIdUrl: string) {
  if (clientIdUrl.length > 2_048) return false;
  try {
    const url = new URL(clientIdUrl);
    return url.protocol === "https:"
      && url.username === ""
      && url.password === ""
      && (url.port === "" || url.port === "443")
      && url.search === ""
      && url.hash === ""
      && url.pathname !== "/";
  } catch {
    return false;
  }
}

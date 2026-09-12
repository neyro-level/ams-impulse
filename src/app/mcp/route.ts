import { createMcpHandler } from "@modelcontextprotocol/server";
import { requireMcpAuth } from "@better-auth/mcp";
import { auth } from "@/modules/identity-access/server";
import { createResearchMcpServer, createResearchMcpServices } from "@/modules/research/server";
import { getConfiguredMcpResource, MCP_SCOPE } from "@/platform/auth/mcp-config";
import {
  consumeMcpSubjectRateLimit,
  isAllowedMcpBrowserRequest,
} from "@/platform/auth/mcp-request-policy";
import { getIdentityPrincipalByUserId } from "@/platform/authorization/principal-factories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function forbidden() {
  return Response.json({ jsonrpc: "2.0", error: { code: -32001, message: "Access denied" }, id: null }, { status: 403, headers: { "Cache-Control": "no-store" } });
}

function rateLimited(retryAfterSeconds: number) {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32002, message: "Rate limit exceeded" }, id: null },
    {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfterSeconds) },
    },
  );
}

export async function POST(request: Request) {
  if (!auth) return new Response(null, { status: 503 });
  const resource = getConfiguredMcpResource(request.url);
  if (!isAllowedMcpBrowserRequest(request, resource)) return forbidden();
  const protectedHandler = requireMcpAuth(auth, async (verifiedRequest, claims) => {
    if (typeof claims.sub !== "string") return forbidden();
    const rateLimit = await consumeMcpSubjectRateLimit(claims.sub);
    if (!rateLimit.allowed) return rateLimited(rateLimit.retryAfterSeconds);
    const principal = await getIdentityPrincipalByUserId(claims.sub);
    if (!principal) return forbidden();
    const handler = createMcpHandler(() => createResearchMcpServer({
      principal,
      ...createResearchMcpServices(principal),
    }), { legacy: "reject" });
    return handler.fetch(verifiedRequest);
  }, { resource, requiredScopes: [MCP_SCOPE], challengeScopes: [MCP_SCOPE] });
  const response = await protectedHandler(request);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

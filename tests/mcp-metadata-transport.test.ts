import { describe, expect, it, vi } from "vitest";
import { createMcpMetadataTransport } from "../src/platform/auth/mcp-metadata-transport.ts";

describe("MCP metadata transport policy", () => {
  it("passes ordinary CIMD metadata through unchanged", async () => {
    const upstream = new Response(JSON.stringify({
      client_id: "https://client.example.com/oauth.json",
      client_name: "Example client",
      redirect_uris: ["https://client.example.com/callback"],
    }), { headers: { "content-type": "application/json" } });
    const transport = createMcpMetadataTransport(vi.fn(async () => upstream));
    await expect(transport("https://client.example.com/oauth.json")).resolves.toBe(upstream);
  });

  it.each(["software_id", "software_version", "software_statement"])(
    "rejects unverified self-asserted %s metadata",
    async (field) => {
      const transport = createMcpMetadataTransport(vi.fn(async () => new Response(
        JSON.stringify({ [field]: "unverified" }),
        { headers: { "content-type": "application/json" } },
      )));
      const response = await transport("https://client.example.com/oauth.json");
      expect(response.status).toBe(422);
    },
  );
});

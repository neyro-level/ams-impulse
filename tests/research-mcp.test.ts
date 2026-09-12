import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";
import { ResearchError, type ResearchService, type ResearchReportService } from "../src/modules/research/index.ts";
import { createResearchMcpServer } from "../src/modules/research/mcp/research-mcp-server.ts";
import { createPlatformAnalystPrincipal } from "./helpers/principal.ts";

async function connect(input: { research: Partial<ResearchService>; reports: Partial<ResearchReportService> }) {
  const server = createResearchMcpServer({
    principal: createPlatformAnalystPrincipal("analyst"),
    research: input.research as ResearchService,
    reports: input.reports as ResearchReportService,
  });
  const client = new Client({ name: "test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

describe("Research MCP server", () => {
  it("publishes only the six bounded research tools", async () => {
    const { client, server } = await connect({ research: {}, reports: {} });
    const result = await client.listTools();
    expect(result.tools.map(({ name }) => name)).toEqual([
      "research_create_draft",
      "research_estimate_run",
      "research_confirm_and_run",
      "research_get_run",
      "research_create_export",
      "research_get_export_download",
    ]);
    await client.close(); await server.close();
  });

  it("passes the complete resource scope to the application service", async () => {
    let received: unknown;
    const { client, server } = await connect({
      research: {},
      reports: { getRun: async (_principal, input) => { received = input; return { runId: "run-1", status: "SUCCEEDED" } as never; } },
    });
    const args = { organizationId: "org-1", projectId: "project-1", researchId: "research-1", runId: "run-1" };
    const result = await client.callTool({ name: "research_get_run", arguments: args });
    expect(received).toEqual(args);
    expect(result.isError).not.toBe(true);
    await client.close(); await server.close();
  });

  it("returns the same non-enumerating error for a substituted UUID", async () => {
    const { client, server } = await connect({
      research: {},
      reports: { getRun: async () => { throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN"); } },
    });
    const result = await client.callTool({ name: "research_get_run", arguments: { organizationId: "foreign", projectId: "foreign", researchId: "foreign", runId: "foreign" } });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: expect.stringContaining('"code":"RESEARCH_NOT_FOUND_OR_FORBIDDEN"') }]);
    await client.close(); await server.close();
  });

  it("normalizes a domain stale error for MCP transport", async () => {
    const stale = Object.assign(new ResearchError("RESEARCH_STALE"), { latestVersion: 4 });
    const { client, server } = await connect({ research: { create: async () => { throw stale; } }, reports: {} });
    const result = await client.callTool({ name: "research_create_draft", arguments: { organizationId: "org-1", projectId: "project-1", title: "Черновик", brief: "", queries: ["запрос"] } });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: expect.stringContaining('"ok":false') }]);
    expect(result.content).toEqual([{ type: "text", text: expect.stringContaining('"code":"STALE_STATE"') }]);
    expect(result.content).toEqual([{ type: "text", text: expect.stringContaining('"latestVersion":4') }]);
    await client.close(); await server.close();
  });
});

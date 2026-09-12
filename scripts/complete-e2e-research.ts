import type { ResearchProvider } from "../src/modules/research/index.ts";
import { PrismaResearchExecutionRepository, ResearchExecutionService } from "../src/modules/research/worker.ts";
import {
  closePrismaClient,
  getPrismaClient,
} from "../src/platform/database/prisma/client.ts";

const [organizationId, projectId, runId] = process.argv.slice(2);
if (process.env.APP_ENV !== "test" || !organizationId || !projectId || !runId) {
  throw new Error("Synthetic Research completion is restricted to an explicit test scope");
}

const provider: ResearchProvider = {
  async getProviderHealth() {
    return { available: true, code: "SYNTHETIC_E2E" };
  },
  async collectYandexSerp({ query }) {
    return [{
      type: "organic",
      url: "https://competitor.example.invalid/result",
      domain: "competitor.example.invalid",
      title: `Synthetic result: ${query}`,
      snippet: "Provider-safe E2E evidence",
    }];
  },
  async collectYandexSuggestions({ query }) {
    return [`${query} suggestion`];
  },
  async collectWordstat({ query }) {
    return [{ phrase: query, monthlyCount: 100, association: false }];
  },
};

const prisma = getPrismaClient();
try {
  const service = new ResearchExecutionService(
    new PrismaResearchExecutionRepository({ organizationId, projectId }, prisma),
    provider,
    async () => {},
  );
  const result = await service.execute(runId);
  if (result.status !== "succeeded") throw new Error(`Synthetic execution failed: ${result.status}`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await closePrismaClient();
}

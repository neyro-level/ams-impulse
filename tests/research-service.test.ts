import { describe, expect, it, vi } from "vitest";
import type { ResearchRecord, ResearchRepository } from "../src/modules/research/index.ts";
import { ResearchService } from "../src/modules/research/server.ts";
import { AuthorizationService } from "../src/platform/authorization/authorization-service.ts";
import { createPlatformAnalystPrincipal, createTenantUserPrincipal } from "./helpers/principal.ts";

vi.mock("../src/platform/database/transaction.ts", () => ({
  runInDatabaseTransaction: async (
    _context: unknown,
    execute: (transaction: { $executeRaw: () => Promise<number> }) => Promise<unknown>,
  ) => execute({ $executeRaw: async () => 0 }),
}));

class MemoryResearchRepository implements ResearchRepository {
  records: ResearchRecord[] = [];
  dailyKopecks = 0;
  monthlyKopecks = 0;
  runIds = new Map<string, string>();
  lastConfirmation: Parameters<ResearchRepository["confirmRun"]>[0] | null = null;
  private reservationTail: Promise<void> = Promise.resolve();
  cancelResult: Awaited<ReturnType<ResearchRepository["cancelRun"]>> = "cancelled";
  activeRun = false;

  async listByProject(organizationId: string, projectId: string) { return this.records.filter((record) => record.organizationId === organizationId && record.projectId === projectId && record.status !== "ARCHIVED"); }
  async listWorkItems(organizationId: string, projectId: string, query: Parameters<ResearchRepository["listWorkItems"]>[2]) {
    const records = (await this.listByProject(organizationId, projectId)).filter((record) =>
      (!query.search || record.title.toLowerCase().includes(query.search.toLowerCase())) &&
      (!query.status || record.status === query.status),
    );
    return {
      items: records.map((record) => ({ ...record, queryCount: record.queries.length, lastRun: null })),
      total: records.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async findById(ref: { organizationId: string; projectId: string; researchId: string }) { return this.records.find((record) => record.id === ref.researchId && record.organizationId === ref.organizationId && record.projectId === ref.projectId) ?? null; }
  async listRuns() { return []; }
  async hasActiveRun() { return this.activeRun; }
  async create(input: Parameters<ResearchRepository["create"]>[0]) {
    const record: ResearchRecord = { id: `research-${this.records.length + 1}`, organizationId: input.organizationId, projectId: input.projectId, title: input.title, brief: input.brief, status: "DRAFT", version: 1, queries: input.queries.map((text, position) => ({ id: `query-${position}`, text, position })), updatedAt: "2026-09-11T00:00:00.000Z" };
    this.records.push(record); return record;
  }
  async update(input: Parameters<ResearchRepository["update"]>[0]) {
    const record = await this.findById(input); if (!record || record.version !== input.version) return null;
    record.title = input.title; record.brief = input.brief; record.version += 1; record.queries = input.queries.map((text, position) => ({ id: `updated-${position}`, text, position })); return record;
  }
  async archive(input: Parameters<ResearchRepository["archive"]>[0]) { const record = await this.findById(input); if (!record || record.version !== input.version) return false; record.status = "ARCHIVED"; record.version += 1; return true; }
  async reserveRunEstimate(input: Parameters<ResearchRepository["reserveRunEstimate"]>[0]) {
    const previous = this.reservationTail;
    let release!: () => void;
    this.reservationTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      const existing = this.runIds.get(input.idempotencyKey);
      if (existing) return { runId: existing, dailyCommittedKopecks: this.dailyKopecks, monthlyCommittedKopecks: this.monthlyKopecks };
      if (this.dailyKopecks + input.estimatedCostKopecks > input.dailyLimitKopecks) throw Object.assign(new Error("RESEARCH_DAILY_LIMIT_EXCEEDED"), { code: "RESEARCH_DAILY_LIMIT_EXCEEDED" });
      if (this.monthlyKopecks + input.estimatedCostKopecks > input.monthlyLimitKopecks) throw Object.assign(new Error("RESEARCH_MONTHLY_LIMIT_EXCEEDED"), { code: "RESEARCH_MONTHLY_LIMIT_EXCEEDED" });
      const runId = `run-${this.runIds.size + 1}`;
      const dailyCommittedKopecks = this.dailyKopecks;
      const monthlyCommittedKopecks = this.monthlyKopecks;
      this.runIds.set(input.idempotencyKey, runId);
      this.dailyKopecks += input.estimatedCostKopecks;
      this.monthlyKopecks += input.estimatedCostKopecks;
      return { runId, dailyCommittedKopecks, monthlyCommittedKopecks };
    } finally {
      release();
    }
  }
  async confirmRun(input: Parameters<ResearchRepository["confirmRun"]>[0]) { this.lastConfirmation = input; return input.expectedEstimatedCostKopecks >= 0 ? { runId: input.runId, outboxEventId: "outbox-1" } : null; }
  async cancelRun() { return this.cancelResult; }
  async appendAudit() {}
}

const authorization = new AuthorizationService({
  async listProjectGrants(userId, product) {
    const records = userId === "analyst" ? [{ product: "tools" as const, organizationId: "atlas", projectId: "secondary", role: "ANALYST" as const }] : [];
    return records.filter((grant) => !product || grant.product === product);
  },
});
const pricing = { estimateRunCostKopecks: (queryCount: number) => queryCount * 125 };
const budget = { dailyLimitKopecks: 50_000, monthlyLimitKopecks: 300_000 };

describe("ResearchService", () => {
  it("creates research only inside an explicitly assigned Tools project", async () => {
    const repository = new MemoryResearchRepository();
    const service = new ResearchService(repository, authorization, pricing, budget);
    const principal = createPlatformAnalystPrincipal("analyst");
    const created = await service.create(principal, { organizationId: "atlas", projectId: "secondary", title: "Рынок вторички", brief: "Москва", queries: ["купить квартиру", "цены на вторичку"] });
    expect(created).toMatchObject({ projectId: "secondary", status: "DRAFT", version: 1 });
    await expect(service.create(principal, { organizationId: "atlas", projectId: "sites", title: "Чужой проект", queries: ["создание сайтов"] })).rejects.toMatchObject({ code: "RESEARCH_NOT_FOUND_OR_FORBIDDEN" });
  });

  it("does not grant Tools access to a client through an SEO membership", async () => {
    const service = new ResearchService(new MemoryResearchRepository(), authorization, pricing, budget);
    const client = createTenantUserPrincipal({ userId: "client", organizationId: "atlas" });
    await expect(service.list(client, "atlas", "secondary")).rejects.toMatchObject({ code: "RESEARCH_NOT_FOUND_OR_FORBIDDEN" });
  });

  it("returns a filterable work list after access is checked", async () => {
    const repository = new MemoryResearchRepository();
    const service = new ResearchService(repository, authorization, pricing, budget);
    const principal = createPlatformAnalystPrincipal("analyst");
    await service.create(principal, { organizationId: "atlas", projectId: "secondary", title: "Рынок офисов", queries: ["офисы"] });
    await service.create(principal, { organizationId: "atlas", projectId: "secondary", title: "Новостройки", queries: ["квартиры"] });
    await expect(service.listWorkItems(principal, "atlas", "secondary", { search: "офис" })).resolves.toMatchObject({ total: 1, items: [{ title: "Рынок офисов", queryCount: 1 }] });
  });

  it("estimates once and requires confirmation without starting provider work", async () => {
    const repository = new MemoryResearchRepository();
    const service = new ResearchService(repository, authorization, pricing, budget, () => new Date("2026-09-11T10:00:00Z"));
    const principal = createPlatformAnalystPrincipal("analyst");
    const research = await service.create(principal, { organizationId: "atlas", projectId: "secondary", title: "Атлас", queries: ["один", "два"] });
    const first = await service.estimateRun(principal, { organizationId: "atlas", projectId: "secondary", researchId: research.id });
    const repeated = await service.estimateRun(principal, { organizationId: "atlas", projectId: "secondary", researchId: research.id });
    expect(first).toMatchObject({ runId: repeated.runId, queryCount: 2, estimatedCostKopecks: 250, confirmationRequired: true });
  });

  it("blocks the daily and monthly budget before creating a run", async () => {
    const repository = new MemoryResearchRepository();
    const service = new ResearchService(repository, authorization, { estimateRunCostKopecks: () => 100 }, budget);
    const principal = createPlatformAnalystPrincipal("analyst");
    const research = await service.create(principal, { organizationId: "atlas", projectId: "secondary", title: "Лимит", queries: ["один"] });
    repository.dailyKopecks = 49_950;
    await expect(service.estimateRun(principal, { organizationId: "atlas", projectId: "secondary", researchId: research.id })).rejects.toMatchObject({ code: "RESEARCH_DAILY_LIMIT_EXCEEDED" });
    repository.dailyKopecks = 0; repository.monthlyKopecks = 299_950;
    await expect(service.estimateRun(principal, { organizationId: "atlas", projectId: "secondary", researchId: research.id })).rejects.toMatchObject({ code: "RESEARCH_MONTHLY_LIMIT_EXCEEDED" });
  });

  it("does not estimate paid work while a research is running", async () => {
    const repository = new MemoryResearchRepository();
    const service = new ResearchService(repository, authorization, pricing, budget);
    const principal = createPlatformAnalystPrincipal("analyst");
    const research = await service.create(principal, { organizationId: "atlas", projectId: "secondary", title: "В работе", queries: ["один"] });
    repository.records[0]!.status = "RUNNING";
    await expect(service.estimateRun(principal, { organizationId: "atlas", projectId: "secondary", researchId: research.id, idempotencyKey: "estimate-running" })).rejects.toMatchObject({ code: "RESEARCH_NOT_EDITABLE" });
  });

  it("rechecks run permission before queuing paid work", async () => {
    const repository = new MemoryResearchRepository();
    const service = new ResearchService(repository, authorization, pricing, budget);
    const analyst = createPlatformAnalystPrincipal("analyst");
    const research = await service.create(analyst, { organizationId: "atlas", projectId: "secondary", title: "Запуск", queries: ["один"] });
    await expect(service.confirmAndQueue(analyst, { organizationId: "atlas", projectId: "secondary", researchId: research.id, runId: "run-1", expectedEstimatedCostKopecks: 100 })).resolves.toEqual({ runId: "run-1", outboxEventId: "outbox-1" });
    expect(repository.lastConfirmation).toMatchObject({ dailyLimitKopecks: 50_000, monthlyLimitKopecks: 300_000 });
    const client = createTenantUserPrincipal({ userId: "client", organizationId: "atlas" });
    await expect(service.confirmAndQueue(client, { organizationId: "atlas", projectId: "secondary", researchId: research.id, runId: "run-1", expectedEstimatedCostKopecks: 100 })).rejects.toMatchObject({ code: "RESEARCH_NOT_FOUND_OR_FORBIDDEN" });
  });

  it("serializes concurrent estimates at the budget boundary", async () => {
    const repository = new MemoryResearchRepository();
    const service = new ResearchService(
      repository,
      authorization,
      { estimateRunCostKopecks: () => 100 },
      { dailyLimitKopecks: 150, monthlyLimitKopecks: 1_000 },
    );
    const analyst = createPlatformAnalystPrincipal("analyst");
    const first = await service.create(analyst, { organizationId: "atlas", projectId: "secondary", title: "Первый", queries: ["один"] });
    const second = await service.create(analyst, { organizationId: "atlas", projectId: "secondary", title: "Второй", queries: ["два"] });

    const results = await Promise.allSettled([
      service.estimateRun(analyst, { organizationId: "atlas", projectId: "secondary", researchId: first.id }),
      service.estimateRun(analyst, { organizationId: "atlas", projectId: "secondary", researchId: second.id }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(repository.dailyKopecks).toBe(100);
  });

  it("cancels only a safe pre-dispatch state and stays idempotent", async () => {
    const repository = new MemoryResearchRepository();
    const service = new ResearchService(repository, authorization, pricing, budget);
    const analyst = createPlatformAnalystPrincipal("analyst");
    const input = { organizationId: "atlas", projectId: "secondary", researchId: "research-1", runId: "run-1" };

    await expect(service.cancelRun(analyst, input)).resolves.toEqual({ runId: "run-1", status: "CANCELLED", changed: true });
    repository.cancelResult = "already-cancelled";
    await expect(service.cancelRun(analyst, input)).resolves.toEqual({ runId: "run-1", status: "CANCELLED", changed: false });
    repository.cancelResult = "unsafe-state";
    await expect(service.cancelRun(analyst, input)).rejects.toMatchObject({ code: "RESEARCH_RUN_NOT_CANCELLABLE" });
  });

  it("edits a partial result but blocks mutations while a run is active", async () => {
    const repository = new MemoryResearchRepository();
    const service = new ResearchService(repository, authorization, pricing, budget);
    const analyst = createPlatformAnalystPrincipal("analyst");
    const research = await service.create(analyst, { organizationId: "atlas", projectId: "secondary", title: "История", queries: ["один"] });
    research.status = "PARTIAL";
    await expect(service.update(analyst, { organizationId: "atlas", projectId: "secondary", researchId: research.id, title: "Новый запуск", brief: "", queries: ["два"], version: research.version })).resolves.toMatchObject({ title: "Новый запуск" });
    repository.activeRun = true;
    await expect(service.update(analyst, { organizationId: "atlas", projectId: "secondary", researchId: research.id, title: "Нельзя", brief: "", queries: ["три"], version: research.version })).rejects.toMatchObject({ code: "RESEARCH_ACTIVE_RUN_EXISTS" });
    await expect(service.archive(analyst, { organizationId: "atlas", projectId: "secondary", researchId: research.id }, research.version)).rejects.toMatchObject({ code: "RESEARCH_ACTIVE_RUN_EXISTS" });
  });
});

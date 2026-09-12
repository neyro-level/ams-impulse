"use server";

import { notFound, redirect } from "next/navigation";
import { isApprovedPrivateStorageUrl, ResearchError } from "../../../modules/research/index.ts";
import { createResearchCabinetService, createResearchReportService } from "../../../modules/research/server.ts";
import { createToolsWorkspaceService } from "../../../modules/tools-workspace/server.ts";
import { defineAction, type DefinedAction } from "../../../platform/actions/define-action.ts";
import type { PrincipalContext } from "../../../platform/authorization/principal.ts";

type ResearchRefInput = { organizationId: string; projectId: string; researchId: string };
type RequestedScope = Pick<ResearchRefInput, "organizationId" | "projectId">;

function text(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }
function queries(formData: FormData) { return text(formData, "queries").split(/\r?\n/).map((value) => value.trim()).filter(Boolean); }
function ref(formData: FormData): ResearchRefInput { return { organizationId: text(formData, "organizationId"), projectId: text(formData, "projectId"), researchId: text(formData, "researchId") }; }
function detailPath(input: ResearchRefInput) { return `/tools/research/${encodeURIComponent(input.researchId)}/`; }
function detailHref(input: ResearchRefInput, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ organizationId: input.organizationId, projectId: input.projectId, ...params });
  return `${detailPath(input)}?${query}`;
}

async function resolveScope(principal: PrincipalContext, requested: RequestedScope) {
  if (principal.kind === "api-client" || principal.kind === "job") throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
  const scope = await createToolsWorkspaceService(principal.userId).resolveProjectScope(principal, requested);
  if (!scope) throw new ResearchError("RESEARCH_NOT_FOUND_OR_FORBIDDEN");
  return scope;
}

function mapResearchError(error: unknown) {
  if (!(error instanceof ResearchError)) return null;
  const messages: Record<ResearchError["code"], string> = {
    RESEARCH_NOT_FOUND_OR_FORBIDDEN: "Исследование не найдено или недоступно.",
    RESEARCH_STALE: "Данные изменились. Обновите страницу и повторите действие.",
    RESEARCH_NOT_EDITABLE: "Исследование нельзя изменить в текущем состоянии.",
    RESEARCH_PRICING_UNAVAILABLE: "Расчёт стоимости временно недоступен.",
    RESEARCH_DAILY_LIMIT_EXCEEDED: "Превышен суточный лимит исследований.",
    RESEARCH_MONTHLY_LIMIT_EXCEEDED: "Превышен месячный лимит исследований.",
    RESEARCH_IDEMPOTENCY_CONFLICT: "Операция уже была отправлена с другими параметрами.",
  };
  return { code: error.code, message: messages[error.code] };
}

function unwrap<TResult>(result: DefinedAction<TResult>): TResult {
  if (result.ok) return result.data;
  if (result.error.code === "RESEARCH_NOT_FOUND_OR_FORBIDDEN") notFound();
  throw Object.assign(new Error(result.error.message), { code: result.error.code, correlationId: result.error.correlationId });
}

const createResearchMutation = defineAction<
  RequestedScope & { title: string; brief: string; queries: string[] },
  Awaited<ReturnType<ReturnType<typeof createResearchCabinetService>["create"]>>
>({
  execute: async ({ principal, input }) => createResearchCabinetService(principal).create(principal, { ...input, ...await resolveScope(principal, input) }),
  mapError: mapResearchError,
  revalidate: [{ path: "/tools/research/" }],
});

const updateResearchMutation = defineAction<ResearchRefInput & { title: string; brief: string; queries: string[]; version: number }, unknown>({
  execute: async ({ principal, input }) => createResearchCabinetService(principal).update(principal, { ...input, ...await resolveScope(principal, input) }),
  mapError: mapResearchError,
  revalidate: ({ input }) => [{ path: detailPath(input) }],
});

const archiveResearchMutation = defineAction<ResearchRefInput & { version: number }, unknown>({
  execute: async ({ principal, input }) => createResearchCabinetService(principal).archive(principal, { ...input, ...await resolveScope(principal, input) }, input.version),
  mapError: mapResearchError,
  revalidate: [{ path: "/tools/research/" }],
});

const estimateResearchMutation = defineAction<ResearchRefInput, Awaited<ReturnType<ReturnType<typeof createResearchCabinetService>["estimateRun"]>>>({
  execute: async ({ principal, input }) => createResearchCabinetService(principal).estimateRun(principal, { ...input, ...await resolveScope(principal, input) }),
  mapError: mapResearchError,
  revalidate: ({ input }) => [{ path: detailPath(input) }],
});

const confirmResearchMutation = defineAction<ResearchRefInput & { runId: string; expectedEstimatedCostKopecks: number }, unknown>({
  execute: async ({ principal, input }) => createResearchCabinetService(principal).confirmAndQueue(principal, { ...input, ...await resolveScope(principal, input) }),
  mapError: mapResearchError,
  revalidate: ({ input }) => [{ path: detailPath(input) }],
});

const downloadResearchExportMutation = defineAction<ResearchRefInput & { runId: string }, { url: string }>({
  execute: async ({ principal, input }) => {
    const resolved = { ...input, ...await resolveScope(principal, input) };
    const reports = createResearchReportService(principal);
    const created = await reports.createExport(principal, resolved);
    return reports.createDownload(principal, { ...resolved, exportId: created.exportId });
  },
  mapError: mapResearchError,
});

export async function createResearchAction(formData: FormData) {
  const created = unwrap(await createResearchMutation({ organizationId: text(formData, "organizationId"), projectId: text(formData, "projectId"), title: text(formData, "title"), brief: text(formData, "brief"), queries: queries(formData) }));
  redirect(detailHref({ organizationId: created.organizationId, projectId: created.projectId, researchId: created.id }));
}

export async function updateResearchAction(formData: FormData) {
  const input = { ...ref(formData), title: text(formData, "title"), brief: text(formData, "brief"), queries: queries(formData), version: Number(text(formData, "version")) };
  unwrap(await updateResearchMutation(input));
  redirect(detailHref(input, { saved: "1" }));
}

export async function archiveResearchAction(formData: FormData) {
  const input = { ...ref(formData), version: Number(text(formData, "version")) };
  unwrap(await archiveResearchMutation(input));
  redirect(`/tools/research/?organizationId=${encodeURIComponent(input.organizationId)}&projectId=${encodeURIComponent(input.projectId)}`);
}

export async function estimateResearchAction(formData: FormData) {
  const input = ref(formData);
  const estimate = unwrap(await estimateResearchMutation(input));
  redirect(detailHref(input, { estimateRunId: estimate.runId, estimateCost: String(estimate.estimatedCostKopecks), estimateQueries: String(estimate.queryCount) }));
}

export async function confirmResearchAction(formData: FormData) {
  const input = { ...ref(formData), runId: text(formData, "runId"), expectedEstimatedCostKopecks: Number(text(formData, "estimatedCostKopecks")) };
  unwrap(await confirmResearchMutation(input));
  redirect(detailHref(input, { queued: "1" }));
}

export async function downloadResearchExportAction(formData: FormData) {
  const input = { ...ref(formData), runId: text(formData, "runId") };
  const download = unwrap(await downloadResearchExportMutation(input));
  if (!isApprovedPrivateStorageUrl(download.url, process.env.APP_ENV === "test")) notFound();
  redirect(download.url);
}

"use server";

import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCurrentCabinetPrincipal } from "../../../modules/identity-access/server.ts";
import { ResearchError } from "../../../modules/research/index.ts";
import { createResearchCabinetService, createResearchReportService } from "../../../modules/research/server.ts";
import { createToolsWorkspaceService } from "../../../modules/tools-workspace/server.ts";
import type { PrincipalContext } from "../../../platform/authorization/principal.ts";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function queries(formData: FormData) {
  return text(formData, "queries").split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
}

function ref(formData: FormData) {
  return { organizationId: text(formData, "organizationId"), projectId: text(formData, "projectId"), researchId: text(formData, "researchId") };
}

async function resolveRef(principal: PrincipalContext, requested: ReturnType<typeof ref>) {
  if (principal.kind === "api-client" || principal.kind === "job") notFound();
  const scope = await createToolsWorkspaceService(principal.userId).resolveProjectScope(
    principal,
    requested,
  );
  if (!scope) notFound();
  return { ...scope, researchId: requested.researchId };
}

function detailHref(input: ReturnType<typeof ref>, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ organizationId: input.organizationId, projectId: input.projectId, ...params });
  return `/tools/research/${encodeURIComponent(input.researchId)}/?${query}`;
}

async function hideForbidden<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ResearchError && error.code === "RESEARCH_NOT_FOUND_OR_FORBIDDEN") notFound();
    throw error;
  }
}

export async function createResearchAction(formData: FormData) {
  const principal = await requireCurrentCabinetPrincipal();
  const scope = await resolveRef(principal, ref(formData));
  const created = await hideForbidden(() => createResearchCabinetService(principal).create(principal, {
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    title: text(formData, "title"),
    brief: text(formData, "brief"),
    queries: queries(formData),
  }));
  redirect(detailHref({ organizationId: created.organizationId, projectId: created.projectId, researchId: created.id }));
}

export async function updateResearchAction(formData: FormData) {
  const principal = await requireCurrentCabinetPrincipal();
  const input = await resolveRef(principal, ref(formData));
  await hideForbidden(() => createResearchCabinetService(principal).update(principal, {
    ...input,
    title: text(formData, "title"),
    brief: text(formData, "brief"),
    queries: queries(formData),
    version: Number(text(formData, "version")),
  }));
  revalidatePath(detailHref(input));
  redirect(detailHref(input, { saved: "1" }));
}

export async function archiveResearchAction(formData: FormData) {
  const principal = await requireCurrentCabinetPrincipal();
  const input = await resolveRef(principal, ref(formData));
  await hideForbidden(() => createResearchCabinetService(principal).archive(principal, input, Number(text(formData, "version"))));
  revalidatePath("/tools/research/");
  redirect(`/tools/research/?organizationId=${encodeURIComponent(input.organizationId)}&projectId=${encodeURIComponent(input.projectId)}`);
}

export async function estimateResearchAction(formData: FormData) {
  const principal = await requireCurrentCabinetPrincipal();
  const input = await resolveRef(principal, ref(formData));
  const estimate = await hideForbidden(() => createResearchCabinetService(principal).estimateRun(principal, input));
  redirect(detailHref(input, { estimateRunId: estimate.runId, estimateCost: String(estimate.estimatedCostKopecks), estimateQueries: String(estimate.queryCount) }));
}

export async function confirmResearchAction(formData: FormData) {
  const principal = await requireCurrentCabinetPrincipal();
  const input = await resolveRef(principal, ref(formData));
  await hideForbidden(() => createResearchCabinetService(principal).confirmAndQueue(principal, {
    ...input,
    runId: text(formData, "runId"),
    expectedEstimatedCostKopecks: Number(text(formData, "estimatedCostKopecks")),
  }));
  revalidatePath(detailHref(input));
  redirect(detailHref(input, { queued: "1" }));
}

export async function downloadResearchExportAction(formData: FormData) {
  const principal = await requireCurrentCabinetPrincipal();
  const input = await resolveRef(principal, ref(formData));
  const reports = createResearchReportService(principal);
  const created = await hideForbidden(() => reports.createExport(principal, { ...input, runId: text(formData, "runId") }));
  const download = await hideForbidden(() => reports.createDownload(principal, { ...input, exportId: created.exportId }));
  if (!download.url.startsWith("https://")) notFound();
  redirect(download.url);
}

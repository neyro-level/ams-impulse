export const dynamic = "force-dynamic";

import { Archive, Download, Play, Save } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "../../../../components/dashboard/PageHeader.tsx";
import { ResearchActionState, type ResearchUiState } from "../../../../components/research/ResearchActionState.tsx";
import { SectionCard } from "../../../../components/dashboard/SectionCard.tsx";
import { StatusBadge, type StatusTone } from "../../../../components/states/StatusBadge.tsx";
import { Button } from "../../../../components/ui/button.tsx";
import { Input, Textarea } from "../../../../components/ui/input.tsx";
import { getCurrentPrincipalState } from "../../../../modules/identity-access/server.ts";
import { createResearchCabinetService } from "../../../../modules/research/server.ts";
import { createToolsWorkspaceService } from "../../../../modules/tools-workspace/server.ts";
import { archiveResearchAction, confirmResearchAction, downloadResearchExportAction, estimateResearchAction, updateResearchAction } from "../actions.ts";

type RouteProps = { params: Promise<{ researchId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const statusLabel: Record<string, string> = { DRAFT: "Черновик", AWAITING_CONFIRMATION: "Ожидает подтверждения", QUEUED: "В очереди", READY: "Готово", RUNNING: "Выполняется", SUCCEEDED: "Завершено", FAILED: "Ошибка", CANCELLED: "Отменено" };
const statusTone: Record<string, StatusTone> = { DRAFT: "neutral", AWAITING_CONFIRMATION: "warning", QUEUED: "info", READY: "info", RUNNING: "warning", SUCCEEDED: "success", FAILED: "destructive", CANCELLED: "neutral" };
const rubles = (kopecks: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(kopecks / 100);
const researchUiStates: ResearchUiState[] = ["STALE_STATE", "RESEARCH_NOT_EDITABLE", "DAILY_LIMIT", "MONTHLY_LIMIT", "PRICING_UNAVAILABLE", "PARTIAL", "FAILED"];

function HiddenRef({ organizationId, projectId, researchId }: { organizationId: string; projectId: string; researchId: string }) {
  return <><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="researchId" value={researchId} /></>;
}

export default async function ResearchDetailPage({ params, searchParams }: RouteProps) {
  const state = await getCurrentPrincipalState();
  if (!state) redirect("/?login=1");
  const principal = state.principal;
  if (principal.kind === "api-client" || principal.kind === "job") notFound();
  const raw = await searchParams;
  const { researchId } = await params;
  const organizationId = first(raw.organizationId);
  const projectId = first(raw.projectId);
  if (!organizationId || !projectId) notFound();
  const scope = await createToolsWorkspaceService(principal.userId).resolveProjectScope(principal, {
    organizationId,
    projectId,
  });
  if (!scope) notFound();
  const ref = { ...scope, researchId };
  const service = createResearchCabinetService(principal);
  const research = await service.get(principal, ref).catch(() => null);
  if (!research) notFound();
  const runs = await service.listRuns(principal, ref);
  const editable = ["DRAFT", "READY", "FAILED"].includes(research.status);
  const cleanHref = `/tools/research/${encodeURIComponent(researchId)}/?organizationId=${encodeURIComponent(organizationId)}&projectId=${encodeURIComponent(projectId)}`;
  const requestedUiState = first(raw.state);
  const explicitUiState = researchUiStates.find((item) => item === requestedUiState);
  const latestRun = runs[0];
  const derivedUiState: ResearchUiState | undefined = latestRun?.safeErrorCode?.includes("PARTIAL")
    ? "PARTIAL"
    : research.status === "FAILED" || latestRun?.status === "FAILED"
      ? "FAILED"
      : undefined;
  const uiState = explicitUiState ?? derivedUiState;
  const estimateRunId = first(raw.runId);
  const estimate = runs.find((run) => run.runId === estimateRunId && run.status === "AWAITING_CONFIRMATION");

  return <div className="space-y-6">
    <PageHeader title={research.title} description={`${research.queries.length} запросов · обновлено ${new Date(research.updatedAt).toLocaleString("ru-RU")}`} backHref={`/tools/research/?organizationId=${encodeURIComponent(scope.organizationId)}&projectId=${encodeURIComponent(scope.projectId)}`} actions={<StatusBadge label={statusLabel[research.status] ?? research.status} tone={statusTone[research.status] ?? "neutral"} />} />
    {uiState ? <ResearchActionState state={uiState} cleanHref={cleanHref} /> : null}
    {first(raw.saved) === "1" ? <p className="rounded-[var(--radius)] bg-[var(--success-soft)] px-4 py-3 text-sm text-app-success" role="status">Изменения сохранены.</p> : null}
    {first(raw.queued) === "1" ? <p className="rounded-[var(--radius)] bg-[var(--info-soft)] px-4 py-3 text-sm text-app-info" role="status">Исследование поставлено в очередь.</p> : null}
    {estimate ? <section className="border-y border-[var(--warning)]/30 bg-[var(--warning-soft)] px-4 py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-app-foreground">Подтвердите платный запуск</h2><p className="mt-1 text-sm text-app-secondary">{estimate.queryCount} запросов, оценка {rubles(estimate.estimatedCostKopecks)}. Значения загружены из сохранённого расчёта и будут проверены перед запуском.</p></div><form action={confirmResearchAction}><HiddenRef {...ref} /><input type="hidden" name="runId" value={estimate.runId} /><input type="hidden" name="estimatedCostKopecks" value={estimate.estimatedCostKopecks} /><Button type="submit"><Play aria-hidden />Подтвердить</Button></form></div>
    </section> : null}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <SectionCard title="Параметры исследования" note={`Версия ${research.version}`}>
        <form action={updateResearchAction} className="space-y-4"><HiddenRef {...ref} /><input type="hidden" name="version" value={research.version} />
          <label className="block space-y-2 text-sm font-medium"><span>Название</span><Input name="title" defaultValue={research.title} required disabled={!editable} /></label>
          <label className="block space-y-2 text-sm font-medium"><span>Задача</span><Textarea name="brief" defaultValue={research.brief} disabled={!editable} /></label>
          <label className="block space-y-2 text-sm font-medium"><span>Запросы</span><Textarea name="queries" defaultValue={research.queries.map((query) => query.text).join("\n")} required disabled={!editable} className="min-h-52" /></label>
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!editable}><Save aria-hidden />Сохранить</Button></div>
        </form>
      </SectionCard>
      <div className="space-y-6">
        <SectionCard title="Запуск"><form action={estimateResearchAction}><HiddenRef {...ref} /><Button type="submit" className="w-full" disabled={!editable || Boolean(estimate)}><Play aria-hidden />Рассчитать стоимость</Button></form><p className="mt-3 text-xs leading-5 text-app-muted-foreground">Лимит пилота: до 20 запросов, 500 ₽ в день и 3000 ₽ в месяц.</p></SectionCard>
        <SectionCard title="Управление"><form action={archiveResearchAction}><HiddenRef {...ref} /><input type="hidden" name="version" value={research.version} /><Button type="submit" variant="outline" className="w-full" disabled={!editable}><Archive aria-hidden />В архив</Button></form></SectionCard>
      </div>
    </div>
    <div id="run-history"><SectionCard title="История запусков" note={`${runs.length} всего`}>
      {runs.length ? <><div className="hidden md:block"><table className="w-full text-left text-sm"><caption className="sr-only">История запусков исследования</caption><thead className="border-b border-[var(--border)] text-app-muted-foreground"><tr><th scope="col" className="px-3 py-2 font-medium">Дата</th><th scope="col" className="px-3 py-2 font-medium">Статус</th><th scope="col" className="px-3 py-2 font-medium">Запросы</th><th scope="col" className="px-3 py-2 font-medium">Стоимость</th><th scope="col" className="px-3 py-2 text-right font-medium">Экспорт</th></tr></thead><tbody>{runs.map((run) => <tr key={run.runId} className="border-b border-[var(--border)] last:border-0"><td className="px-3 py-3">{new Date(run.createdAt).toLocaleString("ru-RU")}</td><td className="px-3 py-3"><StatusBadge label={statusLabel[run.status] ?? run.status} tone={statusTone[run.status] ?? "neutral"} /></td><td className="px-3 py-3">{run.queryCount}</td><td className="px-3 py-3">{rubles(run.actualCostKopecks ?? run.estimatedCostKopecks)}</td><td className="px-3 py-3 text-right">{run.status === "SUCCEEDED" ? <form action={downloadResearchExportAction}><HiddenRef {...ref} /><input type="hidden" name="runId" value={run.runId} /><Button type="submit" size="icon" variant="ghost" aria-label="Скачать CSV"><Download aria-hidden /></Button></form> : "—"}</td></tr>)}</tbody></table></div><div className="grid gap-3 md:hidden">{runs.map((run) => <article key={run.runId} className="rounded-[var(--radius-panel)] border border-[var(--border)] p-4"><div className="flex items-start justify-between gap-3"><time className="text-sm font-medium text-app-foreground" dateTime={run.createdAt}>{new Date(run.createdAt).toLocaleString("ru-RU")}</time><StatusBadge label={statusLabel[run.status] ?? run.status} tone={statusTone[run.status] ?? "neutral"} /></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-app-muted-foreground">Запросы</dt><dd className="mt-1 font-medium text-app-foreground">{run.queryCount}</dd></div><div><dt className="text-app-muted-foreground">Стоимость</dt><dd className="mt-1 font-medium text-app-foreground">{rubles(run.actualCostKopecks ?? run.estimatedCostKopecks)}</dd></div></dl>{run.status === "SUCCEEDED" ? <form action={downloadResearchExportAction} className="mt-4"><HiddenRef {...ref} /><input type="hidden" name="runId" value={run.runId} /><Button type="submit" variant="outline" className="w-full"><Download aria-hidden />Скачать CSV</Button></form> : null}</article>)}</div></> : <p className="text-sm text-app-secondary">Запусков пока нет.</p>}
    </SectionCard></div>
  </div>;
}

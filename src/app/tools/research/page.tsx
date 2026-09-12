export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "../../../components/dashboard/PageHeader.tsx";
import { SectionCard } from "../../../components/dashboard/SectionCard.tsx";
import { MobileFilterSheet } from "../../../components/filters/MobileFilterSheet.tsx";
import { FilterBar } from "../../../components/filters/FilterBar.tsx";
import { StatePanel } from "../../../components/states/StatePanel.tsx";
import { StatusBadge, type StatusTone } from "../../../components/states/StatusBadge.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Input, Textarea } from "../../../components/ui/input.tsx";
import { NativeSelect, NativeSelectOption } from "../../../components/ui/native-select.tsx";
import { Pagination } from "../../../components/ui/pagination.tsx";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table.tsx";
import { getCurrentPrincipalState } from "../../../modules/identity-access/server.ts";
import { researchStatusSchema } from "../../../modules/research/index.ts";
import { createResearchCabinetService } from "../../../modules/research/server.ts";
import { createToolsWorkspaceService } from "../../../modules/tools-workspace/server.ts";
import { createResearchAction } from "./actions.ts";
import { WorkspacePicker } from "./WorkspacePicker.tsx";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const tone: Record<string, StatusTone> = { DRAFT: "neutral", READY: "info", RUNNING: "warning", SUCCEEDED: "success", PARTIAL: "warning", FAILED: "destructive" };
const label: Record<string, string> = { DRAFT: "Черновик", READY: "Готово", RUNNING: "Выполняется", SUCCEEDED: "Завершено", PARTIAL: "Частичный результат", FAILED: "Ошибка" };
const rubles = (kopecks: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(kopecks / 100);

function listHref(raw: Record<string, string>, page: number) {
  const params = new URLSearchParams(raw);
  params.set("page", String(page));
  return `/tools/research/?${params}`;
}

export default async function ResearchPage({ searchParams }: { searchParams: SearchParams }) {
  const state = await getCurrentPrincipalState();
  if (!state) redirect("/?login=1");
  const principal = state.principal;
  if (principal.kind === "api-client" || principal.kind === "job") notFound();
  const options = await createToolsWorkspaceService(principal.userId).listProjectOptions(principal);
  if (!options.length) {
    if (principal.kind !== "platform-admin") notFound();
    return <div className="space-y-6"><PageHeader title="Исследования" description="Исследования по внутренним организациям и проектам." /><StatePanel state="empty" title="Нет проектов Инструментов" description="Создайте организацию и проект, затем выдайте явный доступ к проекту." /></div>;
  }
  const raw = await searchParams;
  const organizationId = first(raw.organizationId) ?? options[0]!.organizationId;
  const projectId = first(raw.projectId) ?? options.find((item) => item.organizationId === organizationId)?.id;
  const selected = options.find((item) => item.organizationId === organizationId && item.id === projectId);
  if (!selected) notFound();
  if (!first(raw.organizationId) || !first(raw.projectId)) redirect(`/tools/research/?organizationId=${encodeURIComponent(selected.organizationId)}&projectId=${encodeURIComponent(selected.id)}`);

  const parsedStatus = researchStatusSchema.safeParse(first(raw.status));
  const period = ["7d", "30d", "90d"].includes(first(raw.period) ?? "") ? first(raw.period)! as "7d" | "30d" | "90d" : "all";
  const sort = ["title", "status", "cost"].includes(first(raw.sort) ?? "") ? first(raw.sort)! as "title" | "status" | "cost" : "updated";
  const result = await createResearchCabinetService(principal).listWorkItems(principal, selected.organizationId, selected.id, {
    page: Math.max(1, Number(first(raw.page) ?? 1) || 1),
    pageSize: 20,
    search: first(raw.search) ?? "",
    status: parsedStatus.success && parsedStatus.data !== "ARCHIVED" ? parsedStatus.data : null,
    period,
    sort,
  });
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  const current = Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => {
    const item = first(value);
    return item ? [[key, item]] : [];
  }));
  const detailHref = (id: string) => `/tools/research/${id}/?organizationId=${encodeURIComponent(selected.organizationId)}&projectId=${encodeURIComponent(selected.id)}`;
  const filterForm = <FilterBar surface="plain" className="md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_160px_180px_auto_auto]">
    <input type="hidden" name="organizationId" value={selected.organizationId} /><input type="hidden" name="projectId" value={selected.id} />
    <Input name="search" defaultValue={first(raw.search) ?? ""} placeholder="Название исследования" aria-label="Поиск исследований" />
    <NativeSelect name="status" defaultValue={parsedStatus.success ? parsedStatus.data : ""} aria-label="Статус исследования"><NativeSelectOption value="">Все статусы</NativeSelectOption><NativeSelectOption value="DRAFT">Черновик</NativeSelectOption><NativeSelectOption value="READY">Готово</NativeSelectOption><NativeSelectOption value="RUNNING">Выполняется</NativeSelectOption><NativeSelectOption value="SUCCEEDED">Завершено</NativeSelectOption><NativeSelectOption value="FAILED">Ошибка</NativeSelectOption></NativeSelect>
    <NativeSelect name="period" defaultValue={period} aria-label="Период обновления"><NativeSelectOption value="all">За всё время</NativeSelectOption><NativeSelectOption value="7d">7 дней</NativeSelectOption><NativeSelectOption value="30d">30 дней</NativeSelectOption><NativeSelectOption value="90d">90 дней</NativeSelectOption></NativeSelect>
    <NativeSelect name="sort" defaultValue={sort} aria-label="Сортировка"><NativeSelectOption value="updated">Сначала обновлённые</NativeSelectOption><NativeSelectOption value="title">По названию</NativeSelectOption><NativeSelectOption value="status">По статусу</NativeSelectOption><NativeSelectOption value="cost">По стоимости запуска</NativeSelectOption></NativeSelect>
    <Button type="submit">Применить</Button>
    <Link href={`/tools/research/?organizationId=${encodeURIComponent(selected.organizationId)}&projectId=${encodeURIComponent(selected.id)}`} className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] border border-[var(--input)] px-4 text-sm font-semibold text-app-foreground">Сбросить</Link>
  </FilterBar>;

  return <div className="space-y-6">
    <PageHeader title="Исследования" description="Рабочий список поисков и конкурентных исследований выбранного проекта." />
    <WorkspacePicker options={options} organizationId={selected.organizationId} projectId={selected.id} />
    <div className="hidden md:block"><SectionCard title="Фильтры" note={`${result.total} найдено`}>{filterForm}</SectionCard></div>
    <MobileFilterSheet title={`Фильтры · ${result.total}`}>{filterForm}</MobileFilterSheet>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0" aria-label="Список исследований">
        {result.items.length ? <>
          <div className="hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--card)] md:block"><Table><TableCaption className="sr-only">Исследования выбранного проекта</TableCaption><TableHeader><TableRow><TableHead>Название</TableHead><TableHead>Статус</TableHead><TableHead>Запросы</TableHead><TableHead>Обновлено</TableHead><TableHead>Последний запуск</TableHead><TableHead className="text-right">Действие</TableHead></TableRow></TableHeader><TableBody>{result.items.map((record) => <TableRow key={record.id}><TableCell className="font-semibold text-app-foreground">{record.title}</TableCell><TableCell><StatusBadge label={label[record.status] ?? record.status} tone={tone[record.status] ?? "neutral"} /></TableCell><TableCell>{record.queryCount}</TableCell><TableCell>{new Date(record.updatedAt).toLocaleDateString("ru-RU")}</TableCell><TableCell>{record.lastRun ? <><p className="font-medium text-app-foreground">{rubles(record.lastRun.actualCostKopecks ?? record.lastRun.estimatedCostKopecks)}</p><p className="text-xs text-app-muted-foreground">{new Date(record.lastRun.createdAt).toLocaleDateString("ru-RU")}</p></> : "—"}</TableCell><TableCell className="text-right"><Link href={detailHref(record.id)} className="inline-flex min-h-10 items-center font-semibold text-app-primary">Открыть</Link></TableCell></TableRow>)}</TableBody></Table></div>
          <div className="grid gap-3 md:hidden">{result.items.map((record) => <article key={record.id} className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-4"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold text-app-foreground">{record.title}</h2><StatusBadge label={label[record.status] ?? record.status} tone={tone[record.status] ?? "neutral"} /></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-app-muted-foreground">Запросы</dt><dd className="mt-1 font-medium">{record.queryCount}</dd></div><div><dt className="text-app-muted-foreground">Обновлено</dt><dd className="mt-1">{new Date(record.updatedAt).toLocaleDateString("ru-RU")}</dd></div><div className="col-span-2"><dt className="text-app-muted-foreground">Последний запуск</dt><dd className="mt-1">{record.lastRun ? `${new Date(record.lastRun.createdAt).toLocaleDateString("ru-RU")} · ${rubles(record.lastRun.actualCostKopecks ?? record.lastRun.estimatedCostKopecks)}` : "Запусков пока нет"}</dd></div></dl><Link href={detailHref(record.id)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius)] bg-[var(--primary)] px-4 text-sm font-semibold text-app-primary-foreground">Открыть исследование</Link></article>)}</div>
          <Pagination className="mt-4" page={result.page} pageCount={pageCount} previousHref={listHref(current, Math.max(1, result.page - 1))} nextHref={listHref(current, Math.min(pageCount, result.page + 1))} />
        </> : <StatePanel state="empty" title="Исследования не найдены" description={first(raw.search) || first(raw.status) || first(raw.period) ? "Измените фильтры или сбросьте поиск." : "Создайте первый черновик для выбранного проекта."} />}
      </section>
      <SectionCard title="Новое исследование" note={`${selected.organizationName} · ${selected.name}`}>
        <form action={createResearchAction} className="space-y-4">
          <input type="hidden" name="organizationId" value={selected.organizationId} /><input type="hidden" name="projectId" value={selected.id} />
          <label className="block space-y-2 text-sm font-medium"><span>Название</span><Input name="title" required minLength={2} maxLength={180} /></label>
          <label className="block space-y-2 text-sm font-medium"><span>Задача</span><Textarea name="brief" maxLength={5000} /></label>
          <label className="block space-y-2 text-sm font-medium"><span>Поисковые запросы</span><Textarea name="queries" required maxLength={10000} /></label>
          <Button type="submit" className="w-full"><Plus aria-hidden />Создать</Button>
        </form>
      </SectionCard>
    </div>
  </div>;
}

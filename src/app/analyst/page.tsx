export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "../../components/dashboard/PageHeader.tsx";
import { SectionCard } from "../../components/dashboard/SectionCard.tsx";
import { MobileFilterSheet } from "../../components/filters/MobileFilterSheet.tsx";
import { FilterBar } from "../../components/filters/FilterBar.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Input } from "../../components/ui/input.tsx";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select.tsx";
import { Pagination } from "../../components/ui/pagination.tsx";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table.tsx";
import {
  getCurrentCabinetRedirect,
  getCurrentPrincipalState,
} from "../../modules/identity-access/server.ts";
import { buildAnalystOverview } from "../../modules/project-registry/presentation.ts";
import type { ProjectSummary } from "../../modules/project-registry/index.ts";
import { hasPermission } from "../../platform/authorization/principal.ts";

type Search = Promise<Record<string, string | string[] | undefined>>;
type Freshness = ProjectSummary["freshness"];
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const freshnessLabels: Record<Freshness, string> = {
  fresh: "Актуально",
  partial: "Частично",
  stale: "Устарело",
  unavailable: "Нет отчёта",
};
const statusLabels = { ACTIVE: "Активен", PLANNED: "План", DISABLED: "Отключён" } as const;

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
    : "—";
}

function pageHref(raw: Record<string, string>, page: number) {
  const params = new URLSearchParams(raw);
  params.set("page", String(page));
  return `/analyst/?${params}`;
}

function ProjectStatus({ project }: { project: ProjectSummary }) {
  const tone = project.status === "DISABLED"
    ? "bg-status-neutral-soft text-status-neutral"
    : project.issueCount > 0
      ? "bg-warning-soft text-warning"
      : "bg-success-soft text-success";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{statusLabels[project.status]}</span>;
}

export default async function AllProjectsPage({ searchParams }: { searchParams: Search }) {
  const cabinetRedirect = await getCurrentCabinetRedirect();
  if (cabinetRedirect) redirect(cabinetRedirect);
  const state = await getCurrentPrincipalState();
  if (!state) redirect("/?login=1");
  if (!hasPermission(state.principal, "project:read:any")) redirect("/dashboard/");

  const raw = await searchParams;
  const overview = await buildAnalystOverview(state.principal);
  const search = (first(raw.search) ?? "").trim().toLocaleLowerCase("ru-RU").slice(0, 100);
  const status = first(raw.status);
  const freshness = first(raw.freshness);
  const sort = first(raw.sort) === "name" || first(raw.sort) === "issues" || first(raw.sort) === "freshness" ? first(raw.sort)! : "issues";
  const requestedPage = Math.max(1, Number(first(raw.page) ?? 1) || 1);
  const filtered = overview.projectCards
    .filter((project) => !search || project.name.toLocaleLowerCase("ru-RU").includes(search) || project.projectSlug.includes(search))
    .filter((project) => !status || status === "all" || project.status === status)
    .filter((project) => !freshness || freshness === "all" || project.freshness === freshness)
    .sort((left, right) => {
      if (sort === "name") return left.name.localeCompare(right.name, "ru-RU");
      if (sort === "freshness") return left.freshness.localeCompare(right.freshness);
      return right.issueCount - left.issueCount || left.name.localeCompare(right.name, "ru-RU");
    });
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const projects = filtered.slice((page - 1) * pageSize, page * pageSize);
  const current = Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => {
    const item = first(value);
    return item ? [[key, item]] : [];
  }));
  const filterForm = <FilterBar surface="plain" className="md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_180px_180px_auto_auto]">
    <Input name="search" defaultValue={first(raw.search) ?? ""} placeholder="Название или адрес проекта" aria-label="Поиск проектов" />
    <NativeSelect name="status" defaultValue={status ?? "all"} aria-label="Статус проекта"><NativeSelectOption value="all">Все статусы</NativeSelectOption><NativeSelectOption value="ACTIVE">Активные</NativeSelectOption><NativeSelectOption value="PLANNED">Плановые</NativeSelectOption><NativeSelectOption value="DISABLED">Отключённые</NativeSelectOption></NativeSelect>
    <NativeSelect name="freshness" defaultValue={freshness ?? "all"} aria-label="Актуальность отчёта"><NativeSelectOption value="all">Любая актуальность</NativeSelectOption><NativeSelectOption value="fresh">Актуально</NativeSelectOption><NativeSelectOption value="partial">Частично</NativeSelectOption><NativeSelectOption value="stale">Устарело</NativeSelectOption><NativeSelectOption value="unavailable">Нет отчёта</NativeSelectOption></NativeSelect>
    <NativeSelect name="sort" defaultValue={sort} aria-label="Сортировка"><NativeSelectOption value="issues">Сначала проблемы</NativeSelectOption><NativeSelectOption value="name">По названию</NativeSelectOption><NativeSelectOption value="freshness">По актуальности</NativeSelectOption></NativeSelect>
    <Button type="submit">Применить</Button>
    <Link href="/analyst/" className="inline-flex min-h-11 items-center justify-center rounded border border-input px-4 text-sm font-semibold text-foreground">Сбросить</Link>
  </FilterBar>;

  return (
    <div className="space-y-6">
      <PageHeader title="Проекты" description="Готовность данных, проблемы и быстрый переход к работе по каждому проекту." />

      <div className="hidden md:block"><SectionCard title="Фильтры" note={`${filtered.length} из ${overview.totalProjects}`}>{filterForm}</SectionCard></div>
      <MobileFilterSheet title={`Фильтры · ${filtered.length}`}>{filterForm}</MobileFilterSheet>

      {projects.length > 0 ? (
        <>
          <div className="hidden rounded-panel border border-border bg-card md:block">
            <Table>
              <TableCaption className="sr-only">Проекты, доступные аналитику</TableCaption>
              <TableHeader><TableRow><TableHead>Проект</TableHead><TableHead>Статус</TableHead><TableHead>Актуальность</TableHead><TableHead>Сайты</TableHead><TableHead>Проблемы</TableHead><TableHead className="text-right">Действие</TableHead></TableRow></TableHeader>
              <TableBody>{projects.map((project) => <TableRow key={project.projectId}>
                <TableCell><p className="font-semibold text-foreground">{project.name}</p><p className="text-xs text-muted-foreground">{project.projectSlug}</p></TableCell>
                <TableCell><ProjectStatus project={project} /></TableCell>
                <TableCell><p className="font-medium text-foreground">{freshnessLabels[project.freshness]}</p><p className="text-xs text-muted-foreground">{formatDate(project.latestReportAt)}</p></TableCell>
                <TableCell>{project.readySites} из {project.totalSites}</TableCell>
                <TableCell><span className={project.issueCount > 0 ? "font-semibold text-warning" : "text-secondary-text"}>{project.issueCount}</span></TableCell>
                <TableCell className="text-right"><Link href={`/c/${project.projectSlug}/`} className="inline-flex min-h-10 items-center font-semibold text-primary">Открыть</Link></TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {projects.map((project) => <article key={project.projectId} className="rounded-card border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-foreground">{project.name}</h2><p className="text-xs text-muted-foreground">{project.projectSlug}</p></div><ProjectStatus project={project} /></div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Актуальность</dt><dd className="mt-1 font-medium text-foreground">{freshnessLabels[project.freshness]}</dd></div><div><dt className="text-muted-foreground">Сайты готовы</dt><dd className="mt-1 font-medium text-foreground">{project.readySites} из {project.totalSites}</dd></div><div><dt className="text-muted-foreground">Последний отчёт</dt><dd className="mt-1 text-foreground">{formatDate(project.latestReportAt)}</dd></div><div><dt className="text-muted-foreground">Проблемы</dt><dd className="mt-1 font-medium text-foreground">{project.issueCount}</dd></div></dl>
              <Link href={`/c/${project.projectSlug}/`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded bg-primary px-4 text-sm font-semibold text-primary-foreground">Открыть проект</Link>
            </article>)}
          </div>
          <Pagination page={page} pageCount={pageCount} previousHref={pageHref(current, Math.max(1, page - 1))} nextHref={pageHref(current, Math.min(pageCount, page + 1))} />
        </>
      ) : (
        <div className="rounded-panel border border-dashed border-border bg-card p-8 text-center">
          <h2 className="font-semibold text-foreground">Проекты не найдены</h2>
          <p className="mt-2 text-sm text-secondary-text">Измените фильтры или сбросьте поиск.</p>
          <Link href="/analyst/" className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary">Показать все проекты</Link>
        </div>
      )}
    </div>
  );
}

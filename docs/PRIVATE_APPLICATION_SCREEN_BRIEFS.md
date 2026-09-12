# Private Application Screen Briefs

Canonical UX briefs for the AMS IMPULSE `APPLICATION_WORKSPACE`. Visual implementation follows `INTERNAL_DASHBOARD_DESIGN_SYSTEM.md`; authorization and safe DTO rules remain in `SECURITY.md` and module contracts.

## `/dashboard/` — decision workspace

- **USER ROLE:** Platform Admin, Analyst or granted client user.
- **PRIMARY TASK:** understand what needs attention now and open the affected work object.
- **PRIMARY WORK OBJECT:** actionable project/site/source states, ordered by urgency.
- **PRIMARY ACTION:** open the affected project or site.
- **KEY DATA:** failed/stale/partial sources, projects without ready sites, recent report/update events; compact totals are secondary.
- **FILTERS:** none until the volume proves a need; role grants already scope the data.
- **DETAIL FLOW:** dashboard issue → project → site/report evidence.
- **STATES:** loading geometry, no access, no projects, all clear, partial/stale, request error.
- **MOBILE PRIORITY:** attention list first; one-tap open; metrics after work objects.

## `/analyst/` — project operations list

- **USER ROLE:** Platform Admin or Analyst with cross-project read permission.
- **PRIMARY TASK:** find a project, compare readiness and open the one requiring work.
- **PRIMARY WORK OBJECT:** server-scoped project list/table.
- **PRIMARY ACTION:** open project.
- **KEY DATA:** project status, freshness, site count, connected/ready sites, issue count.
- **FILTERS:** search and operational status; URL owns shareable state.
- **DETAIL FLOW:** project row → `/c/{clientSlug}/` → site/report.
- **STATES:** loading geometry, empty system, empty filter, stale/partial, permission redirect, request error.
- **MOBILE PRIORITY:** project cards with status, issue/freshness and open action; no compressed desktop table.

## `/admin/*` — platform administration

- **USER ROLE:** Platform Admin.
- **PRIMARY TASK:** manage one selected resource or diagnose one operation.
- **PRIMARY WORK OBJECT:** server-paginated resource table; the selected edit/create form is secondary.
- **PRIMARY ACTION:** save the explicit resource change or open the operational item.
- **KEY DATA:** business identity, status, ownership, updated time and safe correlation where operational.
- **FILTERS:** search, sort and page in URL.
- **DETAIL FLOW:** resource navigation → table → grouped form; destructive changes remain separated.
- **STATES:** loading geometry, empty/filtered-empty, safe error with correlation, permission redirect, stale version, success.
- **MOBILE PRIORITY:** resource cards and full-width forms; stable labels and touch targets.

## `/notifications/` — attention feed

- **USER ROLE:** Platform Admin or Analyst.
- **PRIMARY TASK:** isolate unread/action-required events and open their work context.
- **PRIMARY WORK OBJECT:** chronological notification feed.
- **PRIMARY ACTION:** open the linked project/site/operation.
- **KEY DATA:** category, severity text, event time, read state and safe message.
- **FILTERS:** attention/read state, organization, project, site and category in URL.
- **DETAIL FLOW:** filtered feed → linked work object; read state updates in place.
- **STATES:** loading geometry, no events, empty filter, partial/request error, permission denied.
- **MOBILE PRIORITY:** attention filter first, single-column feed, essential context only.

## `/c/*` — SEO project and site analytics

- **USER ROLE:** explicitly granted client user, Analyst or Platform Admin.
- **PRIMARY TASK:** judge current SEO state and move from project to site evidence.
- **PRIMARY WORK OBJECT:** project site list on project route; one report snapshot on site route.
- **PRIMARY ACTION:** open site report / change report period.
- **KEY DATA:** freshness, source status, period, ranking/search/traffic/conversion evidence and safe limitations.
- **FILTERS:** site navigation and report period; URL carries selected period.
- **DETAIL FLOW:** project → site → report sections and query evidence.
- **STATES:** loading geometry, no sites, partial, stale, provider error, unavailable report, permission/not-found.
- **MOBILE PRIORITY:** freshness and decision summary before dense analytics; tables become focused cards or local scroll containers.

## `/tools/research/` — Research work list

- **USER ROLE:** explicitly granted Tools operator/analyst or Platform Admin.
- **PRIMARY TASK:** find, compare or create a research record in the selected Tools project.
- **PRIMARY WORK OBJECT:** server-filtered Research list/table.
- **PRIMARY ACTION:** open research; creation is a secondary panel/action.
- **KEY DATA:** title, business status, query count, updated time, last run/cost and owner when useful.
- **FILTERS:** organization/project context plus search, status, period, sort and page in URL.
- **DETAIL FLOW:** list row → Research record page.
- **STATES:** loading geometry, no Tools grant, empty system, empty filter, failed/partial, request error.
- **MOBILE PRIORITY:** compact record cards, workspace selector first, create flow below list.

## `/tools/research/[researchId]/` — Research record

- **USER ROLE:** explicitly granted Tools operator/analyst or Platform Admin.
- **PRIMARY TASK:** prepare, estimate, confirm, monitor and export one research.
- **PRIMARY WORK OBJECT:** Research record page with query set and run history.
- **PRIMARY ACTION:** changes by lifecycle: save draft → calculate cost → confirm paid run → download completed result.
- **KEY DATA:** lifecycle status, version, query count, price/limits, last run status/cost and safe failure reason.
- **FILTERS:** none; organization/project context is immutable for the record.
- **DETAIL FLOW:** record summary → editable decision fields → paid confirmation → run history/export.
- **STATES:** stale version, not editable, daily/monthly limit, pricing unavailable, queued/running, partial, failed, success.
- **MOBILE PRIORITY:** status and next allowed action first; forms full-width; run history becomes cards.

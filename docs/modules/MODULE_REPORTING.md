# Module: Reporting

## Purpose

Compiles and serves browser-safe director reports for one authorized site and one period.

## Not In Scope

Provider HTTP, provider credentials, report mutations from browser, second compiler and raw provider UI.

## Ownership

- `ReportSnapshot` persistence contract.
- `SiteReportSnapshot` schema compatibility.
- Period semantics.
- Director analytics projections.
- Single compiler: `src/modules/reporting/domain/report-compiler.ts`.

## Principals

Platform Analyst can read reports globally. Tenant User can read only reports inside fresh Membership organization. Route slugs do not prove access.

## Route Contract

```text
/c/{clientSlug}/{siteSlug}/?period=week|month|quarter|halfYear
```

Invalid or missing period resolves to `month`.

## Report Order

1. Site context, URL, period, timezone, freshness and source state.
2. Ranking: Top-3/Top-10, coverage, movement and tracked queries.
3. Technical/Webmaster health.
4. Search demand.
5. Metrika organic/goal/conversion data.
6. Landing pages, devices, goals, phrases and geography.
7. Competitors, alerts, risks, opportunities and methodology.

## Client Journey Contract

The operational route is `login -> projects -> project -> site -> report -> freshness/source state -> problem -> interpretation -> next action`.

Every report decision surface must expose:

- explicit period and site timezone;
- report generation time and overall `fresh|partial|stale|unavailable` state;
- source name, source status and last fetch time;
- safe business meaning for a failed, denied or quota-limited source;
- one owner/user action or an explicit statement that no action is currently required.

Raw provider payloads, credentials and ambiguous empty shells are never presentation output.

## Invariants

- `SiteReportSnapshot` is the only browser-safe report DTO.
- Current and previous periods have equal length.
- `partial`, `stale`, `unavailable` and `null` stay explicit.
- Webmaster average show position is not exact rank.
- Top-3 is a subset of Top-10.
- Direct query-to-lead attribution is prohibited.
- Sites and periods are never mixed.

## Tests

Compiler semantics, period math, latest snapshot selection, authorization, schema serialization, null/partial/stale rendering and responsive route proof.

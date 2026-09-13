# INTERNAL DASHBOARD DESIGN SYSTEM

Canonical UI contract for private AMS IMPULSE routes: `/dashboard/*`, `/analyst/*`, `/admin/*`, `/notifications/*`, `/c/*` and `/tools/*`.

Architecture/security boundaries are defined by `ARCHITECTURE.md` and `SECURITY.md`. This file owns visual and interaction rules only.

The implementation baseline is **AMS UI Core 5.0**. Project identity stays in this document; the global constitution defines the shared quality floor.

## Character

Private UI is a calm operational workspace: dense, readable, restrained, fast to scan. It is not a marketing page and does not use hero layouts, decorative gradients, glow or oversized editorial type.

## Stack

- Tailwind CSS 4.
- Project-owned shadcn-compatible primitives over Base UI.
- Lucide icons.
- TanStack Table for working tables.
- React Hook Form + Zod for complex forms.
- `nuqs` for URL state.
- Sonner for feedback.
- Recharts through project chart wrappers.
- Self-hosted PT Root UI Variable.

Do not add a second UI/table/chart/icon/state framework without a separate architecture decision.

## Theme

Private routes use `.theme-app`, semantic tokens and PT Root UI.

Core palette:

| Role | Value |
|---|---:|
| Shell | `#082539` |
| Shell hover | `#113850` |
| Primary action | `#197FB8` |
| Ring | `#3997CB` |
| Link | `#0E4F73` |
| Page | `#EDF2F6` |
| Surface | `#FFFFFF` |
| Main text | `#10202F` |

`src/app/globals.css` owns only Tailwind imports, `@theme` roles, theme scopes and true document-wide behavior. Reusable UI consumes generated semantic utilities such as `bg-card`, `text-secondary-text`, `border-border`, `rounded-panel` and `shadow-surface`; arbitrary `var(...)` color/radius utilities and business selectors are forbidden.

## Typography And Geometry

- Base: `14/22`.
- H1: `24/30`.
- H2: `20/26`.
- H3: `16/22`.
- Caption: `12/16`.
- Use `tabular-nums` for metrics.
- Control height: target `44px`, minimum `40px`.
- Radius: controls `10px`, panels `14px`, cards `18px`.
- Spacing scale: `4, 8, 12, 16, 20, 24, 32, 40px`.

Text must wrap/truncate intentionally and never overflow its control or card.

Canonical typography utilities are `text-h1`, `text-h2`, `text-h3`, `text-h4`, `text-body-lg`, `text-body`, `text-body-sm`, `text-label` and `text-caption`. Shell wordmark and navigation markers use their named roles rather than local pixel values.

Page composition uses project-owned `Container`, `Section` and `SectionHeader`. `AppShell` owns the single private `<main>` landmark and the common container; route pages must not create a nested `<main>`. `PageHeader` remains the compatibility facade over `SectionHeader`.

## Shell

Desktop:

- fixed sidebar `232px`, compact `76px`;
- no desktop topbar;
- page title starts in normal content flow;
- navigation is server-built from `PrincipalContext`;
- hidden navigation is not authorization.

Mobile:

- topbar + drawer;
- drawer traps focus and closes predictably;
- touch targets at least `40px`;
- no page-level horizontal overflow.
- install command is available in the drawer when the browser supports PWA installation;

Project navigation opens project page by title; a separate affordance expands sites. Active project/site uses restrained marker, not glow/shadow.

The private product is light-only. Tailwind dark mode is class-based via `.dark`, but application code does not install that class and private route/components do not use `dark:` variants. Generic primitives may keep portable dark variants when required.

## Tables

Tables use TanStack Table + shadcn Table. Filter, sort, count and page are server-side and reflected in URL. Desktop may have local table-container horizontal scroll; whole page must not.

Mobile operational tables render as cards. Empty state, filtered-empty state and permission/error state are distinct.

## Forms And Actions

- Label never replaced by placeholder.
- Client validation is convenience; server validation is authoritative.
- Pending blocks duplicate submission.
- Stale version preserves input and returns clear conflict.
- Destructive action requires explicit object-name confirmation.
- Passwords, provider secrets and sensitive values are never returned in browser-safe result.

Use Base UI/shadcn Accordion for disclosure and NativeSelect for simple select. Popup Select only when search/grouping/complex choice is needed.

## States

Required states: loading, empty, filtered-empty, error, permission-denied, partial, stale.

Color/icon can reinforce status but text carries meaning. Loading state preserves layout geometry.

## Analytics

Every chart must answer a specific question and show period, units, timezone/source context and current status. Chart semantics stay in domain/reporting code, not presentation.

## Mobile / Installable Readiness

Private UI remains web-mobile first. The installable shell includes `manifest.ts` and PWA icons. Its service worker is restricted to versioned immutable static assets and exact icon paths; private navigation and data remain network-only with `no-store` and must never have an offline fallback.

## Acceptance

- Visual QA at `375 / 768 / 1280 / 1440`.
- No incoherent overlap or page overflow.
- Keyboard flow matches visual order.
- Focus-visible is preserved.
- Dialog/drawer focus management works.
- Icon-only action has accessible name.
- Table semantics remain valid.
- Public `ch-*` tokens are absent from private UI.
- Raw HEX is absent from reusable TSX except approved token definition layer.

# INTERNAL DASHBOARD DESIGN SYSTEM

Canonical UI contract for private AMS IMPULSE routes: `/dashboard/*`, `/analyst/*`, `/admin/*`, `/notifications/*`, `/c/*` and `/tools/*`.

Architecture/security boundaries are defined by `ARCHITECTURE.md` and `SECURITY.md`. This file owns visual and interaction rules only.

The implementation baseline is **AMS UI Core 5.0**. Project identity stays in this document; the global constitution defines the shared quality floor.

## Character

Private UI is a calm operational workspace: dense, readable, restrained, fast to scan. It is not a marketing page and does not use hero layouts, decorative gradients, glow or oversized editorial type.

## Stack

- Next.js `16.3.3`, React `19.2.8`, TypeScript `6.0.3` and Tailwind CSS `4.3.3`.
- Project-owned shadcn-compatible primitives over Base UI.
- Lucide icons.
- TanStack Table for working tables.
- React Hook Form + Zod for complex forms.
- `nuqs` for URL state.
- Sonner for feedback.
- Recharts through project chart wrappers.
- Self-hosted PT Root UI Variable.

Do not add a second UI/table/chart/icon/state framework without a separate architecture decision.

## Technical Core

- Runtime owner: App Router server components by default; client components only at interaction boundaries.
- Media: project-owned static assets and Next image facilities; private records and PII never become public media URLs.
- Fonts: self-hosted PT Root UI through the project `@font-face`; this avoids a runtime font provider and is intentionally used instead of `next/font`.
- Forms and transport: React Hook Form/Zod for complex input, `defineAction` for mutations and browser-safe typed results.
- Data boundary: private presentation consumes authorized browser-safe DTOs; Prisma and database imports are forbidden in `src/components/**`.
- SEO: private layouts own `noindex`; public metadata must not be inherited as an indexing promise.
- Analytics: domain/reporting owns metric meaning; presentation receives compiled values and source status.
- Performance budget: no route-wide client rendering, no unbounded table payload and no new blocking third-party runtime; build and four-viewport golden paths are the regression gate.
- Verification cadence: source guards on quick checks, relevant browser proof for changed page families, full daily proof once on final `main`.
- Locale/theme: Russian UI, explicit source timezone where data depends on it, light-only `.theme-app`.
- Mandatory pages: private shell error/permission/loading states and the global `404`; privacy/cookie/thank-you pages belong only to applicable public flows.

## Theme

Private routes use `.theme-app`, semantic tokens and PT Root UI.

Core roles are shell, shell interaction, primary action, focus ring, link, page, surface, foreground and status families. Their numeric values live only in `src/app/globals.css`.

`src/app/globals.css` owns only Tailwind imports, `@theme` roles, theme scopes and true document-wide behavior. Reusable UI consumes generated semantic utilities such as `bg-card`, `text-secondary-text`, `border-border`, `rounded-panel` and `shadow-surface`; arbitrary `var(...)` color/radius utilities and business selectors are forbidden.

## Typography And Geometry

- Use `tabular-nums` for metrics.
- Controls, panels and cards use their semantic geometry roles.
- Spacing follows the Tailwind/project semantic scale; local pixel literals do not define reusable rhythm.

Text must wrap/truncate intentionally and never overflow its control or card.

Canonical typography utilities are `text-h1`, `text-h2`, `text-h3`, `text-h4`, `text-body-lg`, `text-body`, `text-body-sm`, `text-label` and `text-caption`. Shell wordmark and navigation markers use their named roles rather than local pixel values.

Page composition uses project-owned `Container`, `Section` and `SectionHeader`. `AppShell` owns the single private `<main>` landmark and the common container; route pages must not create a nested `<main>`. `PageHeader` remains the compatibility facade over `SectionHeader`.

## Shell

Desktop:

- fixed sidebar with normal and compact states owned by `AppShell`;
- no desktop topbar;
- page title starts in normal content flow;
- navigation is server-built from `PrincipalContext`;
- hidden navigation is not authorization.

Mobile:

- topbar + drawer;
- drawer traps focus and closes predictably;
- touch targets preserve the canonical control minimum;
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

## Visual Character And Anti-goals

The representative page is `/admin/projects/`: it covers shell, heading, filters, form, table/card adaptation and states. The visual language is quiet operational clarity with deliberate information density.

Anti-goals: marketing hero treatment, decorative glow, arbitrary brand colors, nested page shells, invisible permission semantics and one-off component geometry.

## Containers, Rhythm And Shared Patterns

- `Container` owns page width and inline gutters; `Section` owns vertical rhythm.
- `SectionHeader` owns heading hierarchy, description, back action and page actions.
- Shared patterns are shell navigation, page header, section card, filter bar, state panel, responsive data table and form field.
- Reuse order is `REUSE → VARIANT → CREATE`; route files compose these owners.

## Design Intake

Normalized on `2026-09-13` from the existing shipped UI. Inventory covered private theme values, shared primitives, shell geometry, page headers, tables/forms and responsive states; the values were normalized into semantic `@theme` roles without redesigning the product.

## Approved Exceptions

| Scope | Exception | Reason | Review trigger |
|---|---|---|---|
| Recharts wrappers | Library configuration objects contain color/font values | Recharts requires object props rather than CSS classes | chart library or token API change |
| Responsive data table | Runtime `minWidth` style | Width is data-column geometry supplied by the table owner | table primitive redesign |

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

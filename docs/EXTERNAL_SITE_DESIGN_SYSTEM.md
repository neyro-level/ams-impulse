# EXTERNAL SITE DESIGN SYSTEM

Canonical UI contract for public AMS IMPULSE routes: `/`, legal pages and login/lead modals.

Private cabinet UI is governed by [`INTERNAL_DASHBOARD_DESIGN_SYSTEM.md`](INTERNAL_DASHBOARD_DESIGN_SYSTEM.md).

The implementation baseline is **AMS UI Core 5.0**. This document remains the source of project-specific public identity.

## Character

Public profile: cold service-premium. It is strict, technological and clear without cyberpunk, neon, warm luxury or generic SaaS softness.

One screen should communicate one meaning: route, value and action first; decoration second.

## Theme

Public UI uses isolated `.theme-public`, Manrope and `ch-*` tokens only. These tokens must not leak into private reusable components. The Manrope boundary is a locally owned CSS-module class; public business selectors do not live in `globals.css`.

Current temporary home-page rhythm:

```text
dark header/hero → dark footer
```

The service-mechanism and report-proof sections are intentionally not rendered
until the owner approves the next public-page expansion.

Steel-blue accent is used sparingly for primary CTA, focus and one data/structure marker.

## Technical Core

- Runtime owner: Next.js `16.3.3`, React `19.2.8`, TypeScript `6.0.3` and Tailwind CSS `4.3.3`; server composition by default.
- Media: decorative CSS/SVG remains `aria-hidden`; meaningful media requires descriptive alt text and project ownership.
- Fonts: Manrope is packaged through `@fontsource` to avoid a runtime font host; PT Root UI stays private. This is the deliberate project alternative to `next/font`.
- Leads/forms transport: the public lead dialog posts only to the allowlisted AMS Leads path and keeps consent plus anti-spam controls.
- Data boundary: public components contain no private DTO, persistence or provider access.
- SEO owner: root `layout.tsx` owns default metadata; a route owns overrides; `sitemap.ts` and `robots.ts` own discovery policy.
- Analytics: no public analytics runtime is currently installed; adding one requires consent and privacy review.
- Performance budget: no blocking third-party script, no font network dependency, no decorative client component and no horizontal overflow; build plus public browser golden path is the regression gate.
- Verification cadence: contract tests and UI guards on quick checks, changed-route browser proof, final daily proof on `main`.
- Locale/theme: Russian, isolated dark-first `.theme-public`; it is independent of private light-only mode.
- Mandatory pages: home, global `404`, privacy, consent, cookie and terms. A thank-you route is not applicable because success stays inside the lead dialog.

## Typography

- Display: fluid, strong and tight through the `text-public-display` role.
- H1/H2: large editorial headings.
- Body: `16px`, comfortable line height.
- Eyebrow: uppercase small marker only when it adds structure.

Repeated fluid display, heading and label values are exposed through the `text-public-*` roles; one-off decorative geometry may remain component-local.

No meaningful text is baked into images. Long Russian headings wrap instead of shrinking to unreadable size.

## Layout

The site container and responsive gutters are semantic `@theme` roles. Numeric values live only in `src/app/globals.css`.

The shared Tailwind layout roles are `max-w-site`, `px-container` and `sm:px-container-wide`; public section composition may wrap them in the project-owned `Container` and `Section` primitives without importing private visual tokens.

Preferred patterns:

- quiet premium hero;
- editorial 4/8 or 6/6 sections;
- a focused dark hero;
- a dark footer directly after the hero while the compact landing is active.

Whole-page horizontal overflow is forbidden.

## Header

- Left: compact Cyrillic `АМС ИМПУЛЬС` wordmark. `АМС` is an independent framed abbreviation; `ИМПУЛЬС` is the project name. The shared implementation is owned by `PublicBrand` and must not be duplicated in individual public layouts.
- Right: one main action, login to cabinet.
- The primary header remains in the normal first-screen flow. After it leaves the viewport, a separate full-width fixed header with an opaque dark surface, bottom border and shadow appears; its content stays pinned to the viewport edges and keeps login available while the page scrolls.
- The fixed site header uses the explicit `Container` `fluid` variant; narrower page content continues to use `site`, `narrow` or `wide`.
- Login opens modal, not a separate `/login` route.
- Mobile label may shorten to `Войти`.
- Touch targets use the canonical public control minimum.

Secondary nav appears only when real sections exist.

## Hero

Hero contains:

- one strong H1;
- one lead;
- one primary CTA;
- up to three short markers;
- one cold architectural/data visual.

Avoid generic AI heads, robots, rockets, magnifying glasses, Yandex logos, fake dashboards inside images and text embedded in images.

## Modals

Login modal:

- shadcn/Base UI Dialog;
- focus trap and Escape close;
- login + password;
- one primary button `Войти`;
- neutral safe error;
- successful login redirects to `/dashboard/`.

Lead modal:

- name;
- phone;
- required consent;
- honeypot/open-time anti-spam;
- one primary action;
- success/error states without internal API details;
- submit only to allowlisted AMS Leads API.

## Legal Pages And Footer

Legal text is readable HTML and does not require JavaScript. Footer contains brand, contacts and existing legal routes only; no links to nonexistent sections.

## Motion

Use short restrained motion for opacity, border, background and minimal translation. The global reduced-motion contract collapses non-essential animation and transition duration when `prefers-reduced-motion: reduce`. Avoid card scale, parallax and glow.

## Visual Character And Anti-goals

The representative page is `/`: it carries the cold service-premium language through a dark hero, light evidence and dark footer. Anti-goals are generic SaaS softness, cyberpunk/neon, fake results, stock AI imagery, oversized decoration without meaning and private workspace tokens.

## Containers, Section Rhythm And Shared Patterns

- `ImpulseLanding` is a composition layer; the current home page contains only `PublicHeader` inside `HeroSection`, followed by `SiteFooter`.
- `Container` owns repeated width/gutters; each section owns only its internal layout.
- Shared patterns are wordmark, eyebrow, hero copy, architectural hero visual, primary CTA and legal footer.
- Public content data lives beside its section composition, not in the page entry point.

## Design Intake

Normalized on `2026-09-13` from the existing production visual language. Inventory covered the landing, legal pages, login/lead dialogs, public token set, typography, section rhythm and responsive behavior. Values were converted to roles without changing the offer or visual direction.

## Approved Exceptions

| Scope | Exception | Reason | Review trigger |
|---|---|---|---|
| Legal document CSS module | Prose hierarchy has document-specific geometry | Generated legal HTML cannot express the project utility contract directly | legal renderer redesign |
| Hero SVG | SVG presentation attributes reference `ch-*` tokens | The decorative chart is a component-owned vector, not system layout | hero redesign |

## Acceptance

- Mobile: one column, no H1 clipping, visual below text.
- Tablet: wide single column where needed.
- Desktop: split hero works and content remains inside the site container.
- CTA and login targets at least `44px`.
- WCAG AA contrast.
- No public/private token mixing.
- Lead form origin allowlist remains intact.

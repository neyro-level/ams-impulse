# EXTERNAL SITE DESIGN SYSTEM

Canonical UI contract for public AMS IMPULSE routes: `/`, legal pages and login/lead modals.

Private cabinet UI is governed by [`INTERNAL_DASHBOARD_DESIGN_SYSTEM.md`](INTERNAL_DASHBOARD_DESIGN_SYSTEM.md).

The implementation baseline is **AMS UI Core 5.0**. This document remains the source of project-specific public identity.

## Character

Public profile: cold service-premium. It is strict, technological and clear without cyberpunk, neon, warm luxury or generic SaaS softness.

One screen should communicate one meaning: route, value and action first; decoration second.

## Theme

Public UI uses isolated `.theme-public`, Manrope and `ch-*` tokens only. These tokens must not leak into private reusable components. The Manrope boundary is a locally owned CSS-module class; public business selectors do not live in `globals.css`.

Core rhythm:

```text
dark hero → light evidence → soft service detail → light proof → dark CTA/footer
```

Steel-blue accent is used sparingly for primary CTA, focus and one data/structure marker.

## Typography

- Display: `clamp(44px, 6.2vw, 84px)`, strong, tight.
- H1/H2: large editorial headings.
- Body: `16px`, comfortable line height.
- Eyebrow: uppercase small marker only when it adds structure.

Repeated fluid display, heading and label values are exposed through the `text-public-*` roles; one-off decorative geometry may remain component-local.

No meaningful text is baked into images. Long Russian headings wrap instead of shrinking to unreadable size.

## Layout

Container:

```css
max-width: 1360px;
padding-inline: 24px;
```

Mobile padding: `20px`.

The shared Tailwind layout roles are `max-w-site`, `px-container` and `sm:px-container-wide`; public section composition may wrap them in the project-owned `Container` and `Section` primitives without importing private visual tokens.

Preferred patterns:

- quiet premium hero;
- editorial 4/8 or 6/6 sections;
- evidence and service sections with varied rhythm;
- dark final CTA and footer.

Whole-page horizontal overflow is forbidden.

## Header

- Left: compact `AMS IMPULSE` wordmark.
- Right: one main action, login to cabinet.
- Login opens modal, not a separate `/login` route.
- Mobile label may shorten to `Войти`.
- Touch target at least `44px`.

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

Use short motion `150–220ms`: opacity, border, background and translate up to `2px`. The global reduced-motion contract collapses non-essential animation and transition duration when `prefers-reduced-motion: reduce`. Avoid card scale, parallax and glow.

## Acceptance

- `375`: one column, no H1 clipping, visual below text.
- `768`: wide single column where needed.
- `1280`: split hero works.
- `1440`: content sits inside `1360px` container.
- CTA and login targets at least `44px`.
- WCAG AA contrast.
- No public/private token mixing.
- Lead form origin allowlist remains intact.

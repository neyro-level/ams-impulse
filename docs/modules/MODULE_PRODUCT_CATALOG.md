# Module: Product Catalog

## Purpose

Provides the browser-safe registry of AMS products and Tools modules: stable codes, Russian labels, entry routes, audience and `ACTIVE | PLANNED` availability. It does not grant access and does not prove that a user may open a product.

## Data Ownership

The catalog owns immutable code definitions in `src/modules/product-catalog/domain/catalog.ts`. It owns no PostgreSQL tables, tenant records, sessions or permissions.

## Commands / Queries

- Queries: `getProductDefinition`, `getToolDefinition`, `PRODUCTS`, `TOOLS`.
- Commands: none. Availability changes are reviewed code changes.

## Invariants

- Product codes are exactly `seo-monitor`, `leads`, `tools`.
- Tool codes are exactly `research`, `contracts`, `invoices`, `presentations`, `site-clone`.
- Availability and authorization are separate: `ACTIVE` never grants product or project access.
- Browser imports use the root `index.ts`; the module exposes no server secret or database adapter.

## Access / Tenancy

Catalog values are public metadata. `AuthorizationService`, product membership and explicit project grants remain the only access decision. Tenant identifiers do not belong in this module.

## Tests

- `tests/product-catalog.test.ts`
- navigation/authorization coverage consumes the same stable product codes.

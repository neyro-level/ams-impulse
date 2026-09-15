import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DATETIME_CONTRACT_EXEMPT_COLUMNS } from "../src/platform/database/tenant-owned-models.ts";

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260915130000_normalize_public_ams_instants/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

function untypedInstantColumns() {
  const columns: string[] = [];
  for (const match of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const model = match[1];
    const body = match[2];
    const table = body.match(/@@map\("([^"]+)"\)/)?.[1] ?? model;
    const tableSchema = body.match(/@@schema\("([^"]+)"\)/)?.[1] ?? "public";
    for (const line of body.split("\n")) {
      const field = line.match(/^\s*(\w*(?:At|_at))\s+DateTime\??\b/)?.[1];
      if (field && !line.includes("@db.Timestamptz")) {
        columns.push(`${tableSchema}.${table}.${field}`);
      }
    }
  }
  return columns.sort();
}

describe("DateTime schema contract", () => {
  it("leaves only individually declared Better Auth/OAuth columns on library mappings", () => {
    const exemptions = Object.keys(DATETIME_CONTRACT_EXEMPT_COLUMNS).sort();
    expect(untypedInstantColumns()).toEqual(exemptions);
    expect(Object.values(DATETIME_CONTRACT_EXEMPT_COLUMNS).every(Boolean)).toBe(true);
  });

  it("converts every newly normalized AMS instant with an explicit UTC interpretation", () => {
    const conversions = migration.match(/TYPE timestamptz\(3\)/g) ?? [];
    const utcInterpretations = migration.match(/AT TIME ZONE 'UTC'/g) ?? [];
    expect(conversions).toHaveLength(58);
    expect(utcInterpretations).toHaveLength(58);
    for (const libraryTable of [
      "User",
      "Session",
      "jwks",
      "oauthClient",
      "oauthResource",
      "oauthClientResource",
      "oauthRefreshToken",
      "oauthAccessToken",
      "oauthConsent",
      "oauthClientAssertion",
      "Account",
      "Verification",
    ]) {
      expect(migration).not.toContain(`ALTER TABLE "public"."${libraryTable}"`);
    }
  });
});

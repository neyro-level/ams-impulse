import { describe, expect, it } from "vitest";
import {
  PLATFORM_OPERATIONAL_RLS_EXEMPTIONS,
  RLS_AUTHORIZATION_LOOKUP_RELATIONS,
  TENANT_OWNED_MODELS,
} from "../src/platform/database/tenant-owned-models.ts";
import {
  evaluateSecurityDefinerBoundaries,
  evaluateRlsCoverage,
  securityDefinerReadsProtectedRelation,
  type RlsRelationInventory,
} from "../scripts/verify-rls-coverage.ts";

const lookupRelations = new Set<string>(RLS_AUTHORIZATION_LOOKUP_RELATIONS);
const roles = [
  { name: "ams_web", superuser: false, bypassRls: false },
  { name: "ams_worker", superuser: false, bypassRls: false },
];

function protectedRelation(tableName: string): RlsRelationInventory {
  const key = `public.${tableName}`;
  return {
    schemaName: "public",
    tableName,
    ownerName: "seo_monitor_test",
    enabled: true,
    forced: !lookupRelations.has(key),
    lookupOwnerAligned: true,
    policies: [{ name: "scope", using: '"platform"."can_access_seo_project"()', check: "" }],
  };
}

describe("live RLS coverage evaluator", () => {
  it("rejects a SECURITY DEFINER routine that reads a protected relation without authorization", () => {
    const relation = protectedRelation("Notification");
    const unsafeRoutine = {
      schemaName: "platform",
      routineName: "unsafe_notification_count",
      identityArguments: "",
      source: 'SELECT count(*) FROM "public"."Notification"',
    };

    expect(securityDefinerReadsProtectedRelation(unsafeRoutine.source, relation)).toBe(true);
    expect(evaluateSecurityDefinerBoundaries([unsafeRoutine], [relation])).toEqual([
      "platform.unsafe_notification_count(): SECURITY DEFINER reads a protected relation without an authorization function",
    ]);
    expect(evaluateSecurityDefinerBoundaries([
      { ...unsafeRoutine, source: `${unsafeRoutine.source} WHERE platform.can_access_seo_project('', '')` },
    ], [relation])).toEqual([]);
  });

  it("fails closed for a newly discovered organization table without RLS", () => {
    const relations = TENANT_OWNED_MODELS.map(protectedRelation);
    relations.push({
      schemaName: "public",
      tableName: "UnprotectedProbe",
      ownerName: "seo_monitor_test",
      enabled: false,
      forced: false,
      lookupOwnerAligned: true,
      policies: [],
    });

    expect(evaluateRlsCoverage(relations, roles).failures).toEqual(expect.arrayContaining([
      "public.UnprotectedProbe: RLS is not enabled",
      "public.UnprotectedProbe: FORCE RLS is not enabled",
      "public.UnprotectedProbe: no policy references an authorization function",
    ]));
  });

  it("accepts only the named platform-operational exemptions", () => {
    const relations = TENANT_OWNED_MODELS.map(protectedRelation);
    for (const key of Object.keys(PLATFORM_OPERATIONAL_RLS_EXEMPTIONS)) {
      const [schemaName, tableName] = key.split(".");
      relations.push({
        schemaName: schemaName!,
        tableName: tableName!,
        ownerName: "seo_monitor_test",
        enabled: false,
        forced: false,
        lookupOwnerAligned: true,
        policies: [],
      });
    }
    expect(evaluateRlsCoverage(relations, roles).failures).toEqual([]);
  });
});

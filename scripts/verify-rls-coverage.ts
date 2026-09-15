import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { inspectDatabaseTarget } from "../src/platform/config/database-target.ts";
import {
  PLATFORM_OPERATIONAL_RLS_EXEMPTIONS,
  PROTECTED_RELATIONS,
  RLS_AUTHORIZATION_LOOKUP_RELATIONS,
  TENANT_OWNED_MODELS,
} from "../src/platform/database/tenant-owned-models.ts";

export interface RlsRelationInventory {
  schemaName: string;
  tableName: string;
  ownerName: string;
  enabled: boolean;
  forced: boolean;
  lookupOwnerAligned: boolean;
  policies: Array<{ name: string; using: string; check: string }>;
}

export interface RuntimeRoleInventory {
  name: string;
  superuser: boolean;
  bypassRls: boolean;
}

export interface SecurityDefinerRoutineInventory {
  schemaName: string;
  routineName: string;
  identityArguments: string;
  source: string;
}

const lookupRelations = new Set<string>(RLS_AUTHORIZATION_LOOKUP_RELATIONS);
const operationalExemptions: Readonly<Record<string, string>> = PLATFORM_OPERATIONAL_RLS_EXEMPTIONS;
const authorizationReference = /platform.*(?:can_access|is_platform_admin|current_user_id|worker_can_access)/i;
const definerAuthorizationReference = /\b(?:can_access_|worker_can_access_)[a-z0-9_]*\b/i;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function securityDefinerReadsProtectedRelation(
  source: string,
  relation: Pick<RlsRelationInventory, "schemaName" | "tableName">,
) {
  const schema = escapeRegExp(relation.schemaName);
  const table = escapeRegExp(relation.tableName);
  return new RegExp(
    `(?:"${schema}"\\s*\\.\\s*"${table}"|\\b${schema}\\s*\\.\\s*"?${table}"?|"${table}")`,
    "i",
  ).test(source);
}

export function evaluateSecurityDefinerBoundaries(
  routines: SecurityDefinerRoutineInventory[],
  protectedRelations: RlsRelationInventory[],
) {
  const failures: string[] = [];
  for (const routine of routines) {
    const readsProtectedRelation = protectedRelations.some((relation) =>
      securityDefinerReadsProtectedRelation(routine.source, relation));
    if (readsProtectedRelation && !definerAuthorizationReference.test(routine.source)) {
      failures.push(
        `${routine.schemaName}.${routine.routineName}(${routine.identityArguments}): SECURITY DEFINER reads a protected relation without an authorization function`,
      );
    }
  }
  return failures;
}

export function evaluateRlsCoverage(
  relations: RlsRelationInventory[],
  runtimeRoles: RuntimeRoleInventory[],
  securityDefiners: SecurityDefinerRoutineInventory[] = [],
  protectedRelationRegistry: ReadonlyArray<{ relation: string; tenancy: string }> = PROTECTED_RELATIONS,
) {
  const failures: string[] = [];
  const relationKeys = new Set(relations.map((relation) => `${relation.schemaName}.${relation.tableName}`));

  for (const model of TENANT_OWNED_MODELS) {
    if (!relationKeys.has(`public.${model}`)) failures.push(`registered tenant model is absent: public.${model}`);
  }

  for (const registered of protectedRelationRegistry) {
    if (!relationKeys.has(registered.relation)) {
      failures.push(`registered protected relation is absent: ${registered.relation}`);
    }
  }

  for (const relation of relations) {
    const key = `${relation.schemaName}.${relation.tableName}`;
    const exemption = operationalExemptions[key];
    if (exemption) continue;

    if (protectedRelationRegistry.some((registered) => registered.relation === key)
      && relation.policies.length === 0) {
      failures.push(`${key}: protected relation has no policy`);
    }

    if (!relation.enabled) failures.push(`${key}: RLS is not enabled`);
    if (lookupRelations.has(key)) {
      if (relation.forced) failures.push(`${key}: authorization lookup must not FORCE RLS`);
      if (!relation.lookupOwnerAligned) failures.push(`${key}: lookup and SECURITY DEFINER owner differ`);
    } else if (!relation.forced) {
      failures.push(`${key}: FORCE RLS is not enabled`);
    }

    const policyText = relation.policies
      .map((policy) => `${policy.name} ${policy.using} ${policy.check}`)
      .join(" ");
    if (!authorizationReference.test(policyText)) {
      failures.push(`${key}: no policy references an authorization function`);
    }
    if (["ams_web", "ams_worker"].includes(relation.ownerName)) {
      failures.push(`${key}: runtime role owns protected relation`);
    }
  }

  for (const roleName of ["ams_web", "ams_worker"]) {
    const role = runtimeRoles.find((candidate) => candidate.name === roleName);
    if (!role) failures.push(`${roleName}: runtime role is absent`);
    else if (role.superuser || role.bypassRls) failures.push(`${roleName}: runtime role can bypass RLS`);
  }

  failures.push(...evaluateSecurityDefinerBoundaries(
    securityDefiners,
    relations.filter((relation) => !operationalExemptions[`${relation.schemaName}.${relation.tableName}`]),
  ));

  return {
    checked: relations.length,
    protected: relations.filter((relation) => !operationalExemptions[`${relation.schemaName}.${relation.tableName}`]).length,
    exemptions: relations
      .map((relation) => `${relation.schemaName}.${relation.tableName}`)
      .filter((key) => Boolean(operationalExemptions[key])),
    failures,
  };
}

export async function loadRlsCoverageInventory(
  client: Client,
  protectedRelationRegistry: ReadonlyArray<{ relation: string; tenancy: string }> = PROTECTED_RELATIONS,
) {
  const organizationRelations = await client.query<RlsRelationInventory & { policies: unknown }>(`
    SELECT
      namespace.nspname AS "schemaName",
      relation.relname AS "tableName",
      pg_get_userbyid(relation.relowner) AS "ownerName",
      relation.relrowsecurity AS "enabled",
      relation.relforcerowsecurity AS "forced",
      COALESCE(
        jsonb_agg(
          DISTINCT jsonb_build_object(
            'name', policy.polname,
            'using', COALESCE(pg_get_expr(policy.polqual, policy.polrelid), ''),
            'check', COALESCE(pg_get_expr(policy.polwithcheck, policy.polrelid), '')
          )
        ) FILTER (WHERE policy.polname IS NOT NULL),
        '[]'::jsonb
      ) AS policies
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    JOIN pg_attribute AS attribute
      ON attribute.attrelid = relation.oid
     AND attribute.attname = 'organizationId'
     AND NOT attribute.attisdropped
    LEFT JOIN pg_policy AS policy ON policy.polrelid = relation.oid
    WHERE relation.relkind IN ('r', 'p')
      AND namespace.nspname NOT IN ('pg_catalog', 'information_schema')
    GROUP BY namespace.nspname, relation.relname, relation.relowner,
      relation.relrowsecurity, relation.relforcerowsecurity
    ORDER BY namespace.nspname, relation.relname
  `);
  const registeredRelations = await client.query<RlsRelationInventory & { policies: unknown }>(`
    SELECT
      namespace.nspname AS "schemaName",
      relation.relname AS "tableName",
      pg_get_userbyid(relation.relowner) AS "ownerName",
      relation.relrowsecurity AS "enabled",
      relation.relforcerowsecurity AS "forced",
      COALESCE(
        jsonb_agg(
          DISTINCT jsonb_build_object(
            'name', policy.polname,
            'using', COALESCE(pg_get_expr(policy.polqual, policy.polrelid), ''),
            'check', COALESCE(pg_get_expr(policy.polwithcheck, policy.polrelid), '')
          )
        ) FILTER (WHERE policy.polname IS NOT NULL),
        '[]'::jsonb
      ) AS policies
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    LEFT JOIN pg_policy AS policy ON policy.polrelid = relation.oid
    WHERE relation.relkind IN ('r', 'p')
      AND namespace.nspname || '.' || relation.relname = ANY($1::text[])
    GROUP BY namespace.nspname, relation.relname, relation.relowner,
      relation.relrowsecurity, relation.relforcerowsecurity
    ORDER BY namespace.nspname, relation.relname
  `, [protectedRelationRegistry.map((entry) => entry.relation)]);
  const roles = await client.query<{
    name: string;
    superuser: boolean;
    bypassRls: boolean;
  }>(`
    SELECT rolname AS name, rolsuper AS superuser, rolbypassrls AS "bypassRls"
    FROM pg_roles
    WHERE rolname IN ('ams_web', 'ams_worker')
    ORDER BY rolname
  `);
  const lookupOwners = await client.query<{ key: string; aligned: boolean }>(`
    WITH protected_lookup(relation_oid, function_oid) AS (
      VALUES
        ('public."Member"'::regclass, 'platform.can_access_seo_project(text,text)'::regprocedure),
        ('public."Site"'::regclass, 'platform.can_access_seo_site(text,text)'::regprocedure),
        ('public."SeoProjectAccess"'::regclass, 'platform.can_access_seo_project(text,text)'::regprocedure),
        ('tools."ToolsMembership"'::regclass, 'platform.can_access_tools_project(text,text)'::regprocedure),
        ('tools."ToolsProjectAccess"'::regclass, 'platform.can_access_tools_project(text,text)'::regprocedure)
    )
    SELECT
      namespace.nspname || '.' || relation.relname AS key,
      relation.relowner = routine.proowner AS aligned
    FROM protected_lookup
    JOIN pg_class AS relation ON relation.oid = protected_lookup.relation_oid
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    JOIN pg_proc AS routine ON routine.oid = protected_lookup.function_oid
  `);
  const securityDefiners = await client.query<SecurityDefinerRoutineInventory>(`
    SELECT
      namespace.nspname AS "schemaName",
      routine.proname AS "routineName",
      pg_get_function_identity_arguments(routine.oid) AS "identityArguments",
      routine.prosrc AS source
    FROM pg_proc AS routine
    JOIN pg_namespace AS namespace ON namespace.oid = routine.pronamespace
    WHERE routine.prosecdef
      AND namespace.nspname IN ('platform', 'research')
    ORDER BY namespace.nspname, routine.proname, pg_get_function_identity_arguments(routine.oid)
  `);
  const lookupOwnerMap = new Map(lookupOwners.rows.map((row) => [row.key, row.aligned]));
  const relationMap = new Map<string, RlsRelationInventory & { policies: unknown }>();
  for (const relation of [...organizationRelations.rows, ...registeredRelations.rows]) {
    relationMap.set(`${relation.schemaName}.${relation.tableName}`, relation);
  }
  return {
    relations: [...relationMap.values()].map((relation) => ({
      ...relation,
      lookupOwnerAligned: lookupOwnerMap.get(`${relation.schemaName}.${relation.tableName}`) ?? true,
      policies: relation.policies as RlsRelationInventory["policies"],
    })),
    runtimeRoles: roles.rows,
    securityDefiners: securityDefiners.rows,
  };
}

async function main() {
  const requiredEnvironment = ["DATABASE_HOST", "DATABASE_USER", "DATABASE_PASSWORD", "DATABASE_NAME"];
  const missing = requiredEnvironment.filter((name) => !process.env[name]);
  if (missing.length > 0) throw new Error(`Missing required database environment: ${missing.join(", ")}`);
  inspectDatabaseTarget(process.env);

  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? "5432"),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ssl: process.env.DATABASE_SSLMODE === "require" ? { rejectUnauthorized: true } : undefined,
  });
  await client.connect();
  try {
    const inventory = await loadRlsCoverageInventory(client);
    const result = evaluateRlsCoverage(
      inventory.relations,
      inventory.runtimeRoles,
      inventory.securityDefiners,
      PROTECTED_RELATIONS,
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.failures.length > 0) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

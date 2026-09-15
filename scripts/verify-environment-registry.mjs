import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const example = await readFile(path.join(root, ".env.example"), "utf8");
const documentation = await readFile(path.join(root, "docs", "ENVIRONMENT.md"), "utf8");
const runtimeSources = await Promise.all([
  "src/platform/config/server-environment.ts",
  "src/modules/research/infrastructure/configured-research-pricing.ts",
  "src/modules/research/worker.ts",
  "src/platform/auth/mcp-config.ts",
  "src/platform/auth/mcp-request-policy.ts",
].map((file) => readFile(path.join(root, file), "utf8")));
const runtime = runtimeSources.join("\n");

const exampleKeys = example
  .split(/\r?\n/u)
  .map((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1])
  .filter(Boolean);
const exampleSet = new Set(exampleKeys);
const failures = [];

if (exampleSet.size !== exampleKeys.length) failures.push(".env.example contains duplicate keys");

const locallyRelevant = [
  "APP_ENV", "NODE_ENV", "DATABASE_RUNTIME", "DATABASE_URL", "DATABASE_HOST",
  "DATABASE_PORT", "DATABASE_USER", "DATABASE_PASSWORD", "DATABASE_NAME",
  "DATABASE_SSLMODE", "LOCAL_POSTGRES_PORT", "LOCAL_POSTGRES_USER",
  "LOCAL_POSTGRES_PASSWORD", "TEST_DATABASE_HOST", "TEST_DATABASE_PORT",
  "TEST_DATABASE_USER", "TEST_DATABASE_PASSWORD", "TEST_DATABASE_NAME",
  "TEST_DATABASE_SSLMODE", "TEST_RUNTIME_DATABASE_USER",
  "TEST_RUNTIME_DATABASE_PASSWORD", "TEST_WORKER_DATABASE_USER",
  "TEST_WORKER_DATABASE_PASSWORD", "TEST_MIGRATOR_DATABASE_USER",
  "TEST_MIGRATOR_DATABASE_PASSWORD", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "RELEASE_SHA",
  "NEXT_PUBLIC_LEADS_API_URL", "NEXT_PUBLIC_LEADS_PROJECT_ID",
  "NEXT_PUBLIC_LEADS_SITE_KEY", "YANDEX_WEBMASTER_API_BASE_URL",
  "YANDEX_WEBMASTER_OAUTH_TOKEN", "YANDEX_WEBMASTER_SITE_URL",
  "YANDEX_WEBMASTER_TOKEN_STATUS", "YANDEX_METRICA_API_BASE_URL",
  "YANDEX_METRICA_OAUTH_TOKEN", "YANDEX_METRICA_SITE_URL",
  "YANDEX_METRICA_TOKEN_STATUS", "TOPVISOR_USER_ID", "TOPVISOR_API_KEY",
  "TOPVISOR_API_BASE_URL", "OUTBOX_WORKER_ID", "OUTBOX_POLL_DELAY_MS",
  "RESEARCH_WORKER_ID", "LOG_LEVEL", "PGBOSS_SCHEMA", "PGBOSS_RUNTIME_ROLE",
  "XMLRIVER_USER", "XMLRIVER_KEY", "RESEARCH_QUERY_ESTIMATE_KOPECKS",
  "RESEARCH_DAILY_LIMIT_KOPECKS", "RESEARCH_MONTHLY_LIMIT_KOPECKS", "S3_BUCKET",
  "S3_ENDPOINT", "S3_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
  "REQUIRE_OFFSITE",
];

const runtimeValidated = [
  "APP_ENV", "NODE_ENV", "DATABASE_RUNTIME", "DATABASE_URL", "DATABASE_HOST",
  "DATABASE_PORT", "DATABASE_USER", "DATABASE_PASSWORD", "DATABASE_NAME",
  "DATABASE_SSLMODE", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "RELEASE_SHA",
  "RESEARCH_WORKER_ID", "RESEARCH_QUERY_ESTIMATE_KOPECKS",
  "RESEARCH_DAILY_LIMIT_KOPECKS", "RESEARCH_MONTHLY_LIMIT_KOPECKS",
];

for (const key of locallyRelevant) {
  if (!exampleSet.has(key)) failures.push(`.env.example is missing ${key}`);
  if (!documentation.includes(`\`${key}\``)) failures.push(`docs/ENVIRONMENT.md is missing ${key}`);
}

for (const key of runtimeValidated) {
  if (!runtime.includes(key)) failures.push(`runtime validators are missing ${key}`);
}

for (const key of exampleSet) {
  if (!documentation.includes(`\`${key}\``)) failures.push(`undocumented .env.example key: ${key}`);
}

for (const fixedControl of ["MCP_SCOPE", "MCP_CLIENT_METADATA_CACHE_TTL", "MCP_RATE_WINDOW_MS", "MCP_SUBJECT_REQUEST_LIMIT"]) {
  if (!runtime.includes(fixedControl)) failures.push(`code-owned MCP control is missing: ${fixedControl}`);
}

if (failures.length > 0) throw new Error(`Environment registry drift:\n${failures.join("\n")}`);
process.stdout.write(`environment_registry=valid local_keys=${exampleSet.size} runtime_keys=${runtimeValidated.length}\n`);

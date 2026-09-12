import path from "node:path";
import { fileURLToPath } from "node:url";

const requiredKeys = [
  "TEST_DATABASE_HOST",
  "TEST_DATABASE_USER",
  "TEST_DATABASE_PASSWORD",
  "TEST_DATABASE_NAME",
];
const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function validateTestDatabaseTarget(environment) {
  if (environment.APP_ENV?.trim() !== "test") {
    throw new Error("Destructive database tests require APP_ENV=test");
  }

  const missingKeys = requiredKeys.filter((key) => !environment[key]?.trim());
  if (missingKeys.length > 0) {
    throw new Error(`Missing isolated test database variables: ${missingKeys.join(", ")}`);
  }

  const databaseName = environment.TEST_DATABASE_NAME.trim();
  if (!databaseName.toLowerCase().includes("_test")) {
    throw new Error(`Unsafe test database name: ${databaseName}. Expected a name containing _test.`);
  }

  const databaseUser = environment.TEST_DATABASE_USER.trim();
  if (!/(^|_)test($|_)/i.test(databaseUser)) {
    throw new Error("Unsafe test database identity. Expected a dedicated test role.");
  }
  if (databaseUser === environment.LOCAL_POSTGRES_USER?.trim()) {
    throw new Error("Test and development database identities must differ.");
  }

  const host = environment.TEST_DATABASE_HOST.trim().toLowerCase();
  if (!loopbackHosts.has(host)) {
    throw new Error("Destructive database tests are restricted to a loopback PostgreSQL host.");
  }
  const port = environment.TEST_DATABASE_PORT?.trim() || "5432";
  const numericPort = Number(port);
  if (!Number.isInteger(numericPort) || numericPort < 1 || numericPort > 65535) {
    throw new Error("Unsafe test database port.");
  }

  return { host, port, databaseName, databaseUser };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const target = validateTestDatabaseTarget(process.env);
  process.stdout.write(
    `test_database=${target.host}:${target.port}/${target.databaseName} identity=${target.databaseUser}\n`,
  );
}

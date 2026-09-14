import {
  createPgPoolConfig,
  createPgPoolConfigFromEnvironment,
  type DatabaseRuntime,
} from "../src/platform/database/prisma/pool-config.ts";
import { verifyDatabaseRuntimeContract } from "../src/platform/database/prisma/runtime-contract.ts";

function safePrint(runtime: DatabaseRuntime, applicationName: string): void {
  process.stdout.write(
    `database_runtime_contract=ok runtime=${runtime} application_name=${applicationName}\n`,
  );
}

function testRoleUrl(runtime: DatabaseRuntime): string | undefined {
  const base = process.env.DATABASE_URL?.trim();
  const prefix = runtime === "web" ? "TEST_RUNTIME_DATABASE" : "TEST_WORKER_DATABASE";
  const user = process.env[`${prefix}_USER`]?.trim();
  const password = process.env[`${prefix}_PASSWORD`]?.trim();
  if (!base || !user || !password) return undefined;

  const url = new URL(base);
  url.username = user;
  url.password = password;
  return url.toString();
}

const webTestUrl = testRoleUrl("web");
const workerTestUrl = testRoleUrl("worker");
if (webTestUrl && workerTestUrl) {
  for (const [runtime, url] of [["web", webTestUrl], ["worker", workerTestUrl]] as const) {
    const proof = await verifyDatabaseRuntimeContract(createPgPoolConfig(url, runtime), runtime);
    safePrint(runtime, proof.applicationName);
  }
} else {
  const runtime = process.env.DATABASE_RUNTIME as DatabaseRuntime | undefined;
  if (runtime !== "web" && runtime !== "worker") {
    throw new Error(
      "DATABASE_RUNTIME must be web or worker when dedicated test role credentials are unavailable",
    );
  }

  const proof = await verifyDatabaseRuntimeContract(
    createPgPoolConfigFromEnvironment(process.env),
    runtime,
  );
  safePrint(runtime, proof.applicationName);
}

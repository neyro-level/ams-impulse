import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client.ts";
import { Pool } from "pg";
import { createPgPoolConfigFromEnvironment, databaseRuntimeProfile } from "./pool-config.ts";
import type { DatabaseEnvironment } from "../../config/server-environment.ts";

export interface PrismaContext {
  adapter: PrismaPg;
  pool: Pool;
  prisma: PrismaClient;
  close(): Promise<void>;
}

export function createPrismaContext(environment: DatabaseEnvironment): PrismaContext {
  const pool = new Pool(createPgPoolConfigFromEnvironment(environment));
  const adapter = new PrismaPg(pool);
  const runtime = databaseRuntimeProfile(environment.DATABASE_RUNTIME ?? "web");
  const prisma = new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: runtime.transactionMaxWaitMs,
      timeout: runtime.transactionTimeoutMs,
    },
  });

  return {
    adapter,
    pool,
    prisma,
    async close() {
      await prisma.$disconnect();
      await pool.end();
    },
  };
}

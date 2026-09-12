import type { PrismaClient } from "../../generated/prisma/client.ts";

export type DatabaseTransaction = Parameters<
  Parameters<PrismaClient["$transaction"]>[0]
>[0];

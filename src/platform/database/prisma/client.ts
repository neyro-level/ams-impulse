import type { PrismaPg } from "@prisma/adapter-pg";
import type { PrismaClient } from "../../../generated/prisma/client.ts";
import type { Pool } from "pg";
import {
  hasDatabaseConfiguration,
  readDatabaseEnvironment,
} from "../../config/server-environment.ts";
import { createPrismaContext } from "./context.ts";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
  prismaAdapter?: PrismaPg;
  prismaPool?: Pool;
};

function initializePrismaContext() {
  if (!hasDatabaseConfiguration()) {
    throw new Error("Database connection is not configured");
  }

  const context = createPrismaContext(readDatabaseEnvironment());
  globalForPrisma.prismaAdapter = context.adapter;
  globalForPrisma.prismaPool = context.pool;
  globalForPrisma.prisma = context.prisma;
}

export function getPrismaClient() {
  if (!globalForPrisma.prisma || !globalForPrisma.prismaAdapter || !globalForPrisma.prismaPool) {
    initializePrismaContext();
  }

  return globalForPrisma.prisma!;
}

export function getPrismaPool() {
  getPrismaClient();
  return globalForPrisma.prismaPool!;
}

export async function closePrismaClient(): Promise<void> {
  const prisma = globalForPrisma.prisma;
  const pool = globalForPrisma.prismaPool;
  delete globalForPrisma.prisma;
  delete globalForPrisma.prismaAdapter;
  delete globalForPrisma.prismaPool;

  try {
    if (prisma) await prisma.$disconnect();
  } finally {
    if (pool) await pool.end();
  }
}

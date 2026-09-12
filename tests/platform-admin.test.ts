import { describe, expect, it } from "vitest";
import { PrismaIdentityAdminRepository } from "../src/modules/identity-access/server.ts";
import { PrismaProjectRegistryAdminRepository } from "../src/modules/project-registry/server.ts";
import type { PrismaClient } from "../src/generated/prisma/client.ts";

describe("Platform Admin runtime boundary", () => {
  it("requires composition roots to supply the database store explicitly", () => {
    expect(() => new PrismaIdentityAdminRepository(undefined as never)).toThrow(
      "DATABASE_STORE_REQUIRED",
    );
    expect(() => new PrismaProjectRegistryAdminRepository(undefined as never)).toThrow(
      "DATABASE_STORE_REQUIRED",
    );
    const store = {} as PrismaClient;
    expect(() => new PrismaIdentityAdminRepository(store)).not.toThrow();
    expect(() => new PrismaProjectRegistryAdminRepository(store)).not.toThrow();
  });
});

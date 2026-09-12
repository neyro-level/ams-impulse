import { describe, expect, it } from "vitest";
import { inspectArchitectureSource } from "../scripts/verify-architecture.mjs";

describe("structural architecture guards", () => {
  it.each([
    ["src/app/page.tsx", 'import "../modules/research/infrastructure/private.ts";', "App imports infrastructure"],
    ["src/modules/reporting/domain/report.ts", 'import { Prisma } from "../../../generated/prisma/client.ts";', "Prisma in domain/presentation"],
    ["src/modules/reporting/application/service.ts", 'import { hidden } from "../../research/infrastructure/hidden.ts";', "Cross-module deep import"],
    ["src/components/client.tsx", '"use client";\nimport { auth } from "../modules/identity-access/server.ts";', "Client imports server-only boundary"],
    ["src/app/action.ts", '"use server";\nimport { revalidatePath } from "next/cache";', "Raw revalidation outside action adapter"],
    ["src/app/action.ts", '"use server";\nawait service.update(input);', "Server action bypasses action boundary"],
    ["src/modules/x/infrastructure/repo.ts", "prisma.$queryRawUnsafe(sql);", "Unsafe raw SQL"],
    ["src/modules/research/infrastructure/repo.ts", "const id = randomUUID();", "Domain ID bypasses platform identifier policy"],
  ])("rejects %s", (file, source, message) => {
    expect(inspectArchitectureSource(file, source).join("\n")).toContain(message);
  });

  it("allows same-module internals and mutations behind defineAction", () => {
    expect(inspectArchitectureSource(
      "src/modules/research/application/service.ts",
      'import type { Repo } from "./ports/repo.ts";',
    )).toEqual([]);
    expect(inspectArchitectureSource(
      "src/app/action.ts",
      '"use server";\nimport { defineAction } from "../platform/actions/define-action.ts";\nawait service.update(input);',
    )).toEqual([]);
  });
});

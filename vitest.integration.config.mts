import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(import.meta.dirname, "tests/helpers/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    setupFiles: ["./tests/setup-test-env.ts"],
    include: [
      "tests/platform-admin.integration.test.ts",
      "tests/platform-admin-adoption.integration.test.ts",
      "tests/auth.authorization.test.ts",
      "tests/auth-rate-limit.integration.test.ts",
      "tests/notification-rls.integration.test.ts",
      "tests/rls-coverage.integration.test.ts",
      "tests/health.integration.test.ts",
      "tests/monitoring-service.test.ts",
      "tests/prisma-repositories.test.ts",
      "tests/navigation.test.ts",
      "tests/principal.integration.test.ts",
      "tests/project-reference.integration.test.ts",
      "tests/reliability.integration.test.ts",
      "tests/research-list.integration.test.ts",
      "tests/prisma-sync-repository.test.ts",
      "tests/worker.sync-project.test.ts",
      "tests/tenant-ownership.integration.test.ts",
      "tests/tenant-constraints.integration.test.ts",
      "tests/config-sync.integration.test.ts",
      "tests/setup-token.integration.test.ts",
      "tests/research-audit.integration.test.ts",
      "tests/research-isolation.integration.test.ts",
      "tests/research-rls.integration.test.ts",
      "tests/research-concurrency.integration.test.ts",
      "tests/research-audit-safety.integration.test.ts",
      "tests/operational-admin.integration.test.ts",
      "tests/database-runtime-contract.integration.test.ts",
      "tests/datetime-contract-registry.integration.test.ts",
      "tests/platform-schema-privileges.integration.test.ts",
    ],
  },
});

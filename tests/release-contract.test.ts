import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("production backup identity", () => {
  it("runs both pre-migration and scheduled backups as the postgres OS user", () => {
    const deployScript = readFileSync("scripts/deploy-production.mjs", "utf8");
    const backupUnit = readFileSync(
      "ops/systemd/seo-monitor-db-backup.service",
      "utf8",
    );

    expect(deployScript).toContain(
      'run_with_env_file "$BACKUP_ENV_FILE" runuser -u postgres -- /usr/bin/env REQUIRE_OFFSITE=true',
    );
    expect(backupUnit).toContain("User=postgres\nGroup=postgres");
    expect(deployScript).toContain('install -d -o postgres -g postgres -m 0700 "$BACKUP_ROOT_PATH"');
  });
});

describe("production configuration boundary", () => {
  it("deploys migrations without importing operator configuration", () => {
    const deployScript = readFileSync("scripts/deploy-production.mjs", "utf8");
    const integrationRunner = readFileSync("scripts/run-integration-tests.mjs", "utf8");

    expect(deployScript).toContain('run --rm -e PGBOSS_RUNTIME_ROLE="$WORKER_DATABASE_ROLE" migrate');
    expect(deployScript).not.toContain('run --rm migrate seed');
    expect(deployScript).not.toContain("config-sync");
    expect(integrationRunner).toContain("scripts/seed-test-database.mjs");
    expect(integrationRunner).not.toContain("config/clients");
  });

  it("grants pg-boss runtime access without granting schema mutation privileges", () => {
    const migrationScript = readFileSync("scripts/pgboss-migrate.mjs", "utf8");

    expect(migrationScript).toContain("GRANT USAGE ON SCHEMA");
    expect(migrationScript).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES");
    expect(migrationScript).not.toContain("GRANT CREATE ON SCHEMA");
    expect(migrationScript).not.toContain("GRANT ALL PRIVILEGES");
  });

  it("requires recent provider proof and disables logical backup timer for FORCE RLS", () => {
    const deployScript = readFileSync("scripts/deploy-production.mjs", "utf8");

    expect(deployScript).toContain('BACKUP_STRATEGY=logical');
    expect(deployScript).toContain('provider_backup_proof_missing=true');
    expect(deployScript).toContain('PROOF_AGE_SECONDS');
    expect(deployScript).toContain('systemctl disable --now seo-monitor-db-backup.timer');
  });

  it("reapplies managed runtime grants after every schema migration", () => {
    const deployScript = readFileSync("scripts/deploy-production.mjs", "utf8");

    expect(deployScript).toContain(
      'run_psql_with_database_env "$MIGRATOR_ENV_FILE" "$RELEASE/ops/postgres/roles.sql"',
    );
    expect(deployScript).not.toContain('--dbname="$DATABASE_URL"');
  });

  it("requires a healthy worker before completing production rollout", () => {
    const deployScript = readFileSync("scripts/deploy-production.mjs", "utf8");

    expect(deployScript).toContain('deps["worker"]["status"] == "healthy"');
    expect(deployScript).not.toContain('("healthy", "stale", "unknown")');
  });

  it("excludes private operator configuration from the image build context", () => {
    const dockerIgnore = readFileSync(".dockerignore", "utf8");
    const gitIgnore = readFileSync(".gitignore", "utf8");

    expect(dockerIgnore).toContain("config/*");
    expect(dockerIgnore).toContain("!config/examples/**");
    expect(gitIgnore).toContain("/config/*");
    expect(gitIgnore).toContain("!/config/examples/**");
  });
});

describe("production restore readiness", () => {
  it("waits for the final PostgreSQL server after first-run initialization", () => {
    const restoreScript = readFileSync(
      "ops/postgres/restore-smoke.sh",
      "utf8",
    );
    const initComplete = restoreScript.indexOf(
      "PostgreSQL init process complete; ready for start up.",
    );
    const readiness = restoreScript.indexOf("pg_isready", initComplete);
    const createDatabase = restoreScript.indexOf("createdb", readiness);

    expect(initComplete).toBeGreaterThan(-1);
    expect(readiness).toBeGreaterThan(initComplete);
    expect(createDatabase).toBeGreaterThan(readiness);
    expect(restoreScript).toContain("restore_database_not_ready=true");
    expect(restoreScript).toContain(
      'BACKUP_FILE_RESOLVED="$(readlink -f -- "${BACKUP_FILE}")"',
    );
    expect(restoreScript).toContain(
      '-v "${BACKUP_FILE_RESOLVED}:${CONTAINER_BACKUP_FILE}:ro"',
    );
    expect(restoreScript).not.toContain("BACKUP_DIR_MOUNT");
  });
});

describe("production compose networking", () => {
  it("keeps host-local PostgreSQL and web loopback reachable without bridge exposure", () => {
    const compose = readFileSync("docker-compose.production.yml", "utf8");

    expect(compose.match(/network_mode: host/g)).toHaveLength(5);
    expect(compose).toContain("HOSTNAME: 127.0.0.1");
    expect(compose).not.toContain('"127.0.0.1:3000:3000"');
  });

  it("uses one explicit compose project across deploy checks and systemd", () => {
    const deployScript = readFileSync("scripts/deploy-production.mjs", "utf8");
    const webUnit = readFileSync(
      "ops/systemd/seo-monitor-web.service",
      "utf8",
    );

    expect(deployScript).toContain(
      "export COMPOSE_PROJECT_NAME=ams-seo-monitor",
    );
    expect(webUnit).toContain("Environment=COMPOSE_PROJECT_NAME=ams-seo-monitor");
  });

  it("starts and verifies the persistent research worker during rollout", () => {
    const compose = readFileSync("docker-compose.production.yml", "utf8");
    const deployScript = readFileSync("scripts/deploy-production.mjs", "utf8");
    const webUnit = readFileSync("ops/systemd/seo-monitor-web.service", "utf8");

    expect(compose).toContain("research-worker:");
    expect(compose).toContain("command: [\"research-worker\"]");
    expect(webUnit).toContain("up -d web worker research-worker");
    expect(webUnit).toContain("stop web worker research-worker");
    expect(deployScript).toContain("RESEARCH_WORKER_CONTAINER_ID");
    expect(deployScript).toContain('[ "$RESEARCH_HEALTH" = healthy ]');
  });
});

describe("production worker module boundary", () => {
  it("schedules every active database project instead of a hardcoded client", () => {
    const workerUnit = readFileSync("ops/systemd/seo-monitor-worker.service", "utf8");
    const containerEntrypoint = readFileSync(
      "scripts/container-entrypoint.mjs",
      "utf8",
    );

    expect(workerUnit).toContain("maintenance projects-sync daily");
    expect(workerUnit).not.toContain("project-sync alpha");
    expect(containerEntrypoint).toContain('case "projects-sync":');
    expect(containerEntrypoint).toContain('args[0] ?? "daily"');
  });

  it(
    "loads the complete worker dependency graph outside the Next.js runtime",
    () => {
      const result = spawnSync(
        process.execPath,
        ["node_modules/tsx/dist/cli.mjs", "src/worker/main.ts", "module-smoke"],
        { encoding: "utf8", timeout: 30_000 },
      );

      expect(result.stderr).not.toContain("server-only");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("worker_module_smoke_ok");
    },
    30_000,
  );
});

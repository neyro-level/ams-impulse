import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const branch = execFileSync("git", ["branch", "--show-current"], {
  cwd: rootDir,
  encoding: "utf8",
}).trim();
const commitSha = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: rootDir,
  encoding: "utf8",
}).trim();
const dirty = execFileSync("git", ["status", "--porcelain"], {
  cwd: rootDir,
  encoding: "utf8",
}).trim();

if (branch !== "main") {
  throw new Error(`Release artifact must be built from main, current branch: ${branch || "detached"}.`);
}
if (dirty.length > 0) {
  throw new Error("Release artifact requires a clean Git worktree.");
}
if (!/^[0-9a-f]{40}$/.test(commitSha)) {
  throw new Error(`Invalid commit SHA: ${commitSha}`);
}

const artifactsDir = path.join(rootDir, ".release-artifacts");
const stagingDir = path.join(artifactsDir, "staging", commitSha);
const artifactName = `ams-seo-monitor-${commitSha}.tar.gz`;
const artifactPath = path.join(artifactsDir, artifactName);
const imageTag = `ams-seo-monitor:${commitSha}`;
const migratorImageTag = `ams-seo-monitor-migrator:${commitSha}`;
const imageTarPath = path.join(stagingDir, "docker-image.tar");
const imageIidPath = path.join(stagingDir, "image.iid");
const migratorImageIidPath = path.join(stagingDir, "migrator-image.iid");
const baseImage = "node:24.20.0-bookworm-slim";
const baseImageDigest = "sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e";

await rm(stagingDir, { recursive: true, force: true });
await mkdir(stagingDir, { recursive: true });

for (const directory of ["ops"]) {
  await cp(path.join(rootDir, directory), path.join(stagingDir, directory), { recursive: true });
}
await mkdir(path.join(stagingDir, "scripts"), { recursive: true });
await cp(
  path.join(rootDir, "scripts", "verify-managed-backup.mjs"),
  path.join(stagingDir, "scripts", "verify-managed-backup.mjs"),
);
for (const file of [
  ".dockerignore",
  "Dockerfile",
  "docker-compose.production.yml",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
]) {
  await cp(path.join(rootDir, file), path.join(stagingDir, file));
}
for (const relativePath of [
  "ops/nginx/ams-seo-monitor.conf",
  "ops/systemd/seo-monitor-web.service",
  "ops/systemd/seo-monitor-worker.service",
  "ops/systemd/seo-monitor-worker.timer",
  "ops/systemd/seo-monitor-topvisor-checks.service",
  "ops/systemd/seo-monitor-topvisor-checks.timer",
  "ops/systemd/seo-monitor-competitors.service",
  "ops/systemd/seo-monitor-competitors.timer",
  "ops/systemd/seo-monitor-outbox.service",
  "ops/systemd/seo-monitor-outbox.timer",
  "ops/systemd/seo-monitor-db-backup.service",
  "ops/systemd/seo-monitor-db-backup.timer",
  "ops/systemd/seo-monitor-alerts.service",
  "ops/systemd/seo-monitor-alerts.timer",
  "ops/monitoring/check-owner-alerts.sh",
  "ops/postgres/backup.sh",
  "ops/postgres/restore-smoke.sh",
  "ops/postgres/managed-restore-proof.sh",
  "ops/release/live-proof.sh",
]) {
  const targetPath = path.join(stagingDir, relativePath);
  const content = await readFile(targetPath, "utf8");
  await writeFile(targetPath, content.replace(/\r\n/g, "\n"), "utf8");
}

function buildImage(target, tag, iidPath) {
  const result = spawnSync("docker", [
    "buildx",
    "build",
    "--platform",
    "linux/amd64",
    "--target",
    target,
    "--tag",
    tag,
    "--iidfile",
    iidPath,
    "--load",
    ".",
  ], { cwd: rootDir, encoding: "utf8", stdio: "inherit" });
  if (result.status !== 0) throw new Error(`docker buildx ${target} failed with status ${result.status}.`);
}

buildImage("runtime", imageTag, imageIidPath);
buildImage("migrator", migratorImageTag, migratorImageIidPath);

const saveResult = spawnSync("docker", ["save", "--output", imageTarPath, imageTag, migratorImageTag], {
  cwd: rootDir,
  encoding: "utf8",
  stdio: "inherit",
});
if (saveResult.status !== 0) {
  throw new Error(`docker save failed with status ${saveResult.status}.`);
}

const lockBytes = await readFile(path.join(rootDir, "pnpm-lock.yaml"));
const dependencyLockSha256 = createHash("sha256").update(lockBytes).digest("hex");
const imageDigest = (await readFile(imageIidPath, "utf8")).trim();
const migratorImageDigest = (await readFile(migratorImageIidPath, "utf8")).trim();
const manifest = {
  application: "ams-seo-monitor",
  repository: "integrator-p/ams-impulse",
  source: "SourceCraft main",
  commitSha,
  createdAt: new Date().toISOString(),
  buildTimestamp: new Date().toISOString(),
  runtime: "docker-node-v24.20.0-linux-amd64",
  baseImage,
  baseImageDigest,
  artifactFormat: "tar.gz",
  imageTag,
  imageDigest,
  migratorImageTag,
  migratorImageDigest,
  dependencyLockSha256,
  deploymentStrategy: "build-off-host-load-image-and-compose-up",
};

await writeFile(
  path.join(stagingDir, "release-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

const tarResult = spawnSync("tar", ["-czf", artifactPath, "-C", stagingDir, "."], {
  cwd: rootDir,
  encoding: "utf8",
});
if (tarResult.status !== 0) {
  throw new Error(`tar failed: ${tarResult.stderr || tarResult.stdout}`);
}

const artifactHash = createHash("sha256");
for await (const chunk of createReadStream(artifactPath)) {
  artifactHash.update(chunk);
}
const artifactSha256 = artifactHash.digest("hex");
await writeFile(`${artifactPath}.sha256`, `${artifactSha256}  ${artifactName}\n`, "utf8");
await rm(stagingDir, { recursive: true, force: true });

console.log(
  JSON.stringify(
    {
      artifactPath,
      artifactSha256,
      commitSha,
      dependencyLockSha256,
      imageTag,
      imageDigest,
      migratorImageTag,
      migratorImageDigest,
      baseImageDigest,
    },
    null,
    2,
  ),
);

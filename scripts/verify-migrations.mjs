import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const migrationsDirectory = path.join(root, "prisma", "migrations");
const manifestPath = path.join(migrationsDirectory, "manifest.sha256.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const entries = await readdir(migrationsDirectory, { withFileTypes: true });
const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const failures = [];
const identifiers = new Set();

for (const directory of directories) {
  const match = /^(\d{14})_[a-z0-9_]+$/.exec(directory);
  if (!match) {
    failures.push(`Invalid migration directory name: ${directory}`);
    continue;
  }
  if (identifiers.has(match[1])) failures.push(`Duplicate migration identifier: ${match[1]}`);
  identifiers.add(match[1]);

  const sql = await readFile(path.join(migrationsDirectory, directory, "migration.sql"), "utf8");
  const canonicalSql = sql.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const actual = createHash("sha256").update(canonicalSql, "utf8").digest("hex");
  if (!manifest[directory]) failures.push(`Migration is not registered: ${directory}`);
  else if (manifest[directory] !== actual) failures.push(`Immutable migration changed: ${directory}`);
}

for (const directory of Object.keys(manifest)) {
  if (!directories.includes(directory)) failures.push(`Registered migration is missing: ${directory}`);
}

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const scriptText = Object.entries(packageJson.scripts ?? {}).map(([name, command]) => `${name}: ${command}`).join("\n");
if (/prisma\s+db\s+push/.test(scriptText)) failures.push("package.json exposes prisma db push");
if (packageJson.scripts?.["prisma:generate"] !== "prisma generate") failures.push("Explicit prisma:generate script is missing");
for (const required of ["build", "build:collector", "typecheck"]) {
  if (!String(packageJson.scripts?.[required] ?? "").includes("prisma:generate")) {
    failures.push(`${required} must invoke prisma:generate explicitly`);
  }
}

if (failures.length > 0) throw new Error(`Migration contract failed:\n${failures.join("\n")}`);
process.stdout.write(`migration_contract=valid migrations=${directories.length}\n`);

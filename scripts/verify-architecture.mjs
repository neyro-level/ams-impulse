import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(import.meta.dirname, "..");
const sourceDir = path.join(rootDir, "src");

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!entryPath.includes(`${path.sep}generated${path.sep}`)) {
        files.push(...(await collectFiles(entryPath)));
      }
    } else if (/\.(?:ts|tsx|mts|cts)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
}

function importSpecifiers(source) {
  const specifiers = [];
  for (const match of source.matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\s+["']([^"']+)["']/g)) {
    specifiers.push(match[1] ?? match[2]);
  }
  return specifiers;
}

function resolveProjectImport(relativePath, specifier) {
  if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
  if (!specifier.startsWith(".")) return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), specifier));
}

export function inspectArchitectureSource(relativePath, source) {
  const failures = [];
  const normalizedPath = relativePath.replaceAll("\\", "/");
  const sourceModule = normalizedPath.match(/^src\/modules\/([^/]+)\//)?.[1] ?? null;
  const specifiers = importSpecifiers(source);

  if (source.includes('from "@prisma/client"') || source.includes("from '@prisma/client'")) {
    failures.push(`Legacy generated Prisma import: ${normalizedPath}`);
  }
  if (/\$queryRawUnsafe\s*\(/.test(source) || /\$executeRawUnsafe\s*\(/.test(source)) {
    failures.push(`Unsafe raw SQL: ${normalizedPath}`);
  }
  if (source.includes("infrastructure/database/prisma")) {
    failures.push(`Legacy database boundary import: ${normalizedPath}`);
  }
  if (
    /generated\/prisma\//.test(source)
    && !/^src\/(?:platform\/database|modules\/[^/]+\/infrastructure|generated)\//.test(normalizedPath)
  ) {
    failures.push(`Prisma outside infrastructure boundary: ${normalizedPath}`);
  }
  if (source.includes("ActorContext")) {
    failures.push(`Legacy authorization context: ${normalizedPath}`);
  }

  for (const specifier of specifiers) {
    const target = resolveProjectImport(normalizedPath, specifier);
    const targetModule = target?.match(/^src\/modules\/([^/]+)\/(domain|application|infrastructure|presentation|mcp)\//)?.[1];
    if (targetModule && targetModule !== sourceModule) {
      failures.push(`Cross-module deep import: ${normalizedPath} -> ${target}`);
    }

    if (/^src\/app\//.test(normalizedPath) && target && (
      /^src\/infrastructure\//.test(target) ||
      /^src\/modules\/[^/]+\/infrastructure\//.test(target)
    )) {
      failures.push(`App imports infrastructure: ${normalizedPath} -> ${target}`);
    }

    if (/^src\/modules\/[^/]+\/(domain|presentation)\//.test(normalizedPath) && (
      specifier.startsWith("@prisma") ||
      (target != null && (/generated\/prisma\//.test(target) || /platform\/database\//.test(target)))
    )) {
      failures.push(`Prisma in domain/presentation: ${normalizedPath}`);
    }

    if (/^["']use client["'];?\s*/.test(source) && (
      specifier === "server-only" ||
      (target != null && (
        /\/(server|worker)(?:\.(?:ts|tsx|mts|cts))?$/.test(target) ||
        /platform\/database\//.test(target) ||
        /platform\/auth\/(?!client(?:\.|$))/.test(target)
      ))
    )) {
      failures.push(`Client imports server-only boundary: ${normalizedPath} -> ${specifier}`);
    }
  }

  if (specifiers.includes("next/cache") && normalizedPath !== "src/platform/actions/define-action.ts") {
    failures.push(`Raw revalidation outside action adapter: ${normalizedPath}`);
  }
  if (/^["']use server["'];?\s*/.test(source)
    && /\.(create|update|archive|confirm|save|set|remove|request)[A-Za-z]*\s*\(/.test(source)
    && !/\b(defineAction|platformAdminAction)\b/.test(source)) {
    failures.push(`Server action bypasses action boundary: ${normalizedPath}`);
  }
  if (
    normalizedPath.includes("/infrastructure/")
    && /\/modules\/(research|tools-workspace|identity-access)\//.test(normalizedPath)
    && /\brandomUUID\s*\(|\bgen_random_uuid\s*\(/.test(source)
  ) {
    failures.push(`Domain ID bypasses platform identifier policy: ${normalizedPath}`);
  }

  return failures;
}

export async function verifyArchitecture() {
  const failures = [];
  for (const filePath of await collectFiles(sourceDir)) {
    const source = await readFile(filePath, "utf8");
    const relativePath = path.relative(rootDir, filePath).replaceAll("\\", "/");
    failures.push(...inspectArchitectureSource(relativePath, source));
  }

  if (failures.length > 0) {
    throw new Error(`Architecture guard failed:\n${failures.join("\n")}`);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  await verifyArchitecture();
  process.stdout.write("architecture_static_guards=valid\n");
}

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

interface RiskRule {
  label: string;
  matches: (path: string) => boolean;
}

export interface RiskMatch {
  path: string;
  reasons: string[];
}

const RISK_RULES: RiskRule[] = [
  { label: "database schema or migration", matches: (path) => path.startsWith("prisma/") },
  { label: "Prisma CLI contract", matches: (path) => path === "prisma.config.ts" },
  {
    label: "platform auth",
    matches: (path) => path.startsWith("src/platform/auth/"),
  },
  {
    label: "platform authorization",
    matches: (path) => path.startsWith("src/platform/authorization/"),
  },
  {
    label: "platform database",
    matches: (path) => path.startsWith("src/platform/database/"),
  },
  {
    label: "platform security",
    matches: (path) => path.startsWith("src/platform/security/"),
  },
  {
    label: "platform jobs",
    matches: (path) => path.startsWith("src/platform/jobs/"),
  },
  {
    label: "platform external boundary",
    matches: (path) => /^src\/platform\/(?:http|mcp)\//u.test(path),
  },
  {
    label: "collector runtime",
    matches: (path) => path.startsWith("collector/"),
  },
  {
    label: "module worker",
    matches: (path) => /^src\/modules\/[^/]+\/worker(?:\.[^/]+|\/)/u.test(path),
  },
  {
    label: "module infrastructure",
    matches: (path) => /^src\/modules\/[^/]+\/infrastructure\//u.test(path),
  },
  {
    label: "container build",
    matches: (path) => /^Dockerfile(?:\..+)?$/u.test(path),
  },
  {
    label: "container topology",
    matches: (path) => /^(?:docker-)?compose[^/]*\.ya?ml$/u.test(path),
  },
  {
    label: "SourceCraft configuration",
    matches: (path) => path.startsWith(".sourcecraft/"),
  },
  {
    label: "security scan policy",
    matches: (path) => path === ".semgrep.yml",
  },
  {
    label: "environment contract",
    matches: (path) => path === ".env.example",
  },
  {
    label: "dependency contract",
    matches: (path) => path === "package.json" || path === "pnpm-lock.yaml",
  },
  {
    label: "production operations",
    matches: (path) => path.startsWith("ops/"),
  },
  {
    label: "verification or CI script",
    matches: (path) => path.startsWith("scripts/ci/") || /^scripts\/verify-[^/]+\.(?:mjs|ts)$/u.test(path),
  },
  {
    label: "release or runtime script",
    matches: (path) =>
      /^scripts\/[^/]*(?:runtime|release|deploy|migrat|worker|backup|restore)[^/]*\.(?:mjs|ts|sh)$/u.test(path),
  },
];

function normalizePath(path: string): string {
  return path.trim().replaceAll("\\", "/").replace(/^\.\//u, "");
}

export function classifyRiskPaths(paths: readonly string[]): RiskMatch[] {
  return [...new Set(paths.map(normalizePath).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .flatMap((path) => {
      const reasons = RISK_RULES.filter((rule) => rule.matches(path)).map(
        (rule) => rule.label,
      );
      return reasons.length > 0 ? [{ path, reasons }] : [];
    });
}

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a Git ref.`);
  }
  return value;
}

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function resolveCommit(ref: string): string {
  return git("rev-parse", "--verify", `${ref}^{commit}`);
}

function main(): void {
  const baseRef = readFlag("--base") ?? process.env.RISK_BASE_REF ?? "origin/main";
  const headRef = readFlag("--head") ?? process.env.RISK_HEAD_REF ?? "HEAD";
  const baseCommit = resolveCommit(baseRef);
  const headCommit = resolveCommit(headRef);
  const mergeBase = git("merge-base", baseCommit, headCommit);
  const changedPaths = git("diff", "--name-only", "-z", mergeBase, headCommit)
    .split("\0")
    .filter(Boolean);
  const matches = classifyRiskPaths(changedPaths);

  console.log(`base=${baseCommit}`);
  console.log(`head=${headCommit}`);
  console.log(`merge_base=${mergeBase}`);
  console.log(`changed_files=${changedPaths.length}`);

  if (matches.length === 0) {
    console.log("RISK_HINT=NO_MECHANICAL_MATCH");
    console.log("Semantic STANDARD/RISKY review is still required before merge.");
    return;
  }

  console.log("RISK_HINT=REVIEW_REQUIRED");
  for (const match of matches) {
    console.log(`- ${match.path}: ${match.reasons.join(", ")}`);
  }
  console.log("A mechanical match can raise risk but cannot declare any change safe.");
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  main();
}

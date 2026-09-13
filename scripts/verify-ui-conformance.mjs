import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function filesUnder(relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? filesUnder(path.join(relativeDirectory, entry.name)) : [path.join(relativeDirectory, entry.name)]));
  return nested.flat();
}

const violations = [];
const warnings = [];
const trackedUiFiles = [...await filesUnder("src"), ...await filesUnder("docs")].filter((file) => /\.(?:css|md|ts|tsx)$/.test(file));
for (const file of trackedUiFiles) {
  if (file.replaceAll("\\", "/").startsWith("docs/archive/")) continue;
  const source = await readFile(path.join(root, file), "utf8");
  if (/--crm-|var\(--crm-/.test(source)) violations.push(`${file}: legacy crm token`);
  if (/--radius-control|var\(--radius-control\)/.test(source)) violations.push(`${file}: obsolete radius-control token`);
  if (/Application Design System 2\.0|UI Development Constitution 1\.0|Constitution 3\.1/.test(source)) violations.push(`${file}: obsolete UI canon version`);
}

const reusableComponents = (await filesUnder("src/components"))
  .filter((file) => /\.(?:css|tsx)$/.test(file));
for (const file of reusableComponents) {
  const source = await readFile(path.join(root, file), "utf8");
  if (/#[0-9a-f]{3,8}\b|rgba?\(/i.test(source)) violations.push(`${file}: system color must use a semantic token`);
  if (/(?:text|bg|border|ring|fill|stroke)-(?:white|black|slate|gray|zinc|neutral|stone|red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)(?:\b|\/|\[)/.test(source)) violations.push(`${file}: Tailwind palette color must use a semantic token`);
  if (/rounded-(?:sm|md|lg|xl|2xl|3xl)|rounded-\[[0-9]+px\]/.test(source)) violations.push(`${file}: system radius must use a canonical radius token`);
  if (/(?:text|bg|border|ring|divide|fill|stroke|shadow)-\[[^\]]*var\(--(?!ch-)/.test(source)) violations.push(`${file}: private visual utility must use a generated semantic role`);
  const normalized = file.replaceAll("\\", "/");
  if (normalized.includes("/components/ui/") && /--ch-/.test(source)) violations.push(`${file}: generic primitive depends on public brand tokens`);

  for (const match of source.matchAll(/<Button\b[\s\S]{0,500}?\bsize=["']icon["'][\s\S]{0,500}?>/g)) {
    if (!/aria-label=|aria-labelledby=/.test(match[0])) violations.push(`${file}: icon-only Button needs an accessible name`);
  }
}

for (const file of reusableComponents.filter((item) => item.endsWith(".tsx"))) {
  const normalized = file.replaceAll("\\", "/");
  const source = await readFile(path.join(root, file), "utf8");
  if (/(?:@prisma|generated\/prisma|platform\/database)/.test(source)) violations.push(`${file}: presentation component imports persistence`);
  if (/style=\{\{/.test(source) && normalized !== "src/components/tables/AdminDataTable.tsx") violations.push(`${file}: reusable UI contains a system inline style`);
  if (normalized.startsWith("src/components/marketing/") && /(?:text-\[(?:clamp|\d)|tracking-\[|leading-\[)/.test(source)) {
    violations.push(`${file}: public typography must use an approved semantic role`);
  }
  if (normalized.startsWith("src/components/layout/") || normalized.startsWith("src/components/marketing/sections/")) {
    if (/^["']use client["'];/m.test(source)) violations.push(`${file}: section/layout must remain server-first`);
  }
  if ((normalized.startsWith("src/components/marketing/") || normalized.startsWith("src/app/")) && source.length > 14_000) {
    warnings.push(`${file}: heuristic monolith threshold exceeded`);
  }
}

for (const relativeDirectory of ["src/app/admin", "src/app/analyst", "src/app/dashboard", "src/app/c", "src/app/demo", "src/app/notifications", "src/app/tools"]) {
  for (const file of (await filesUnder(relativeDirectory)).filter((item) => /\.tsx$/.test(item))) {
    const source = await readFile(path.join(root, file), "utf8");
    if (/--ch-|var\(--ch-/.test(source)) violations.push(`${file}: public brand token is forbidden in private UI`);
    if (/#[0-9a-f]{3,8}\b|rgba?\(/i.test(source)) violations.push(`${file}: private UI color must use a semantic token`);
    if (/(?:text|bg|border|ring|fill|stroke)-(?:white|black|slate|gray|zinc|neutral|stone|red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)(?:\b|\/|\[)/.test(source)) violations.push(`${file}: private UI palette color must use a semantic token`);
    if (/rounded-(?:sm|md|lg|xl|2xl|3xl)|rounded-\[[0-9]+px\]/.test(source)) violations.push(`${file}: private UI radius must use a canonical radius token`);
    if (/(?:text|bg|border|ring|divide|fill|stroke|shadow)-\[[^\]]*var\(--/.test(source)) violations.push(`${file}: private visual utility must use a generated semantic role`);
    if (/(?:text|tracking|leading)-\[[^\]]+\]/.test(source)) violations.push(`${file}: private typography must use an approved role`);
  }
}

for (const file of reusableComponents.filter((item) => !item.replaceAll("\\", "/").includes("/components/marketing/"))) {
  const source = await readFile(path.join(root, file), "utf8");
  if (/--ch-|var\(--ch-/.test(source)) violations.push(`${file}: public brand token is forbidden outside marketing components`);
}

const legacySelect = path.join(root, "src/components/ui/select.tsx");
try {
  await readFile(legacySelect, "utf8");
  violations.push("src/components/ui/select.tsx: native control must use the NativeSelect contract");
} catch (error) {
  if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
}

const globals = await readFile(path.join(root, "src/app/globals.css"), "utf8");
const allowedGlobalClasses = new Set(["theme-app", "theme-public", "sr-only"]);
for (const match of globals.matchAll(/^\s*\.([a-zA-Z][\w-]*)/gm)) {
  if (!allowedGlobalClasses.has(match[1])) violations.push(`src/app/globals.css: non-global selector .${match[1]}`);
}

const componentsConfig = JSON.parse(await readFile(path.join(root, "components.json"), "utf8"));
const expectedAliases = { components: "@/components", utils: "@/shared/lib/cn", ui: "@/components/ui", lib: "@/shared/lib", hooks: "@/shared/hooks" };
for (const [name, expected] of Object.entries(expectedAliases)) {
  if (componentsConfig.aliases?.[name] !== expected) violations.push(`components.json: alias ${name} must be ${expected}`);
}

const landingCss = await readFile(path.join(root, "src/components/marketing/ImpulseLanding.module.css"), "utf8");
for (const marker of ['@import "@fontsource/manrope/400.css"', 'font-family: "PT Root UI"']) {
  if (!globals.includes(marker)) violations.push(`src/app/globals.css: missing font contract ${marker}`);
}
if (!landingCss.includes('font-family: "Manrope"')) violations.push("src/components/marketing/ImpulseLanding.module.css: public font boundary is missing");

for (const file of ["src/components/marketing/sections/HeroSection.tsx", "src/components/marketing/LegalDocument.tsx", "src/app/not-found.tsx"]) {
  const source = await readFile(path.join(root, file), "utf8");
  const h1Count = [...source.matchAll(/<h1\b/g)].length;
  if (h1Count !== 1) violations.push(`${file}: public page owner must contain exactly one logical H1, found ${h1Count}`);
}

for (const file of ["src/app/not-found.tsx", "src/modules/identity-access/presentation/LoginDialog.tsx"]) {
  const source = await readFile(path.join(root, file), "utf8");
  if (/(?:text-\[(?:clamp|\d)|tracking-\[|leading-\[)/.test(source)) violations.push(`${file}: public typography must use an approved semantic role`);
}

const themeRoleNames = [...globals.matchAll(/^\s*--(?:color|radius|shadow|text|container|spacing)-([\w-]+):/gm)].map((match) => match[1]);
const sourceCorpus = (await Promise.all((await filesUnder("src")).filter((file) => /\.(?:css|ts|tsx)$/.test(file) && file !== "src/app/globals.css").map((file) => readFile(path.join(root, file), "utf8")))).join("\n");
const requiredRoleAllowlist = new Set(["sm"]);
for (const role of themeRoleNames) {
  if (!requiredRoleAllowlist.has(role) && !sourceCorpus.includes(role)) warnings.push(`src/app/globals.css: semantic role ${role} appears unused`);
}

for (const file of (await filesUnder("src")).filter((item) => /\.(?:css|ts|tsx)$/.test(item))) {
  const normalized = file.replaceAll("\\", "/");
  if (normalized.includes("/components/ui/") || normalized === "src/app/globals.css") continue;
  const source = await readFile(path.join(root, file), "utf8");
  if (/\bdark:/.test(source)) violations.push(`${file}: dark variant is allowed only inside generic UI primitives`);
}

if (violations.length > 0) {
  console.error(`UI conformance failed:\n${violations.map((item) => `- [FAIL] ${item}`).join("\n")}`);
  process.exit(1);
}

if (warnings.length > 0) console.warn(`UI conformance report:\n${warnings.map((item) => `- [REPORT] ${item}`).join("\n")}`);
console.log("UI conformance: AMS UI Core 5.0 tokens, primitives, accessibility and global CSS boundaries are clean.");

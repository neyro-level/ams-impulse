import { readFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const root = process.cwd();
const globalsPath = path.join(root, "src/app/globals.css");
const globals = await readFile(globalsPath, "utf8");
const fixture = `${globals}\n@source inline("bg-primary text-foreground border-border rounded-panel rounded-card text-h1 text-body max-w-wide px-container py-section-md shadow-surface dark:bg-primary");`;
const result = await postcss([tailwindcss()]).process(fixture, { from: globalsPath });

const expectedSelectors = [
  ".bg-primary",
  ".text-foreground",
  ".border-border",
  ".rounded-panel",
  ".rounded-card",
  ".text-h1",
  ".text-body",
  ".max-w-wide",
  ".px-container",
  ".py-section-md",
  ".shadow-surface",
  ".dark\\:bg-primary",
];

const missing = expectedSelectors.filter((selector) => !result.css.includes(selector));
if (missing.length > 0) {
  console.error(`Tailwind theme fixture failed: missing ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Tailwind theme fixture: AMS UI Core 5.0 semantic roles compile successfully.");

import { spawnSync } from "node:child_process";

const EXPECTED_RULE_IDS = new Set([
  "ams.dynamic-code-execution",
  "ams.child-process-shell",
  "ams.child-process-exec",
  "ams.prisma-unsafe-raw",
  "ams.tls-verification-disabled",
  "ams.environment-url-fetch",
  "ams.hardcoded-secret",
]);

function scan(target) {
  const result = spawnSync(
    "semgrep",
    ["scan", "--metrics", "off", "--jobs", "1", "--json", "--config", ".semgrep.yml", target],
    { encoding: "utf8", shell: false },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Semgrep fixture scan failed for ${target}: ${result.stderr.trim() || "unknown error"}`);
  }
  return JSON.parse(result.stdout);
}

const positive = scan("fixtures/semgrep/positive.ts");
const matched = new Set(positive.results.map((finding) => finding.check_id));
const missing = [...EXPECTED_RULE_IDS].filter((ruleId) => !matched.has(ruleId));
if (missing.length > 0) {
  throw new Error(`Semgrep rules without positive proof: ${missing.join(", ")}`);
}

const negative = scan("fixtures/semgrep/negative.ts");
if (negative.results.length > 0) {
  const unexpected = [...new Set(negative.results.map((finding) => finding.check_id))];
  throw new Error(`Semgrep false positives in negative fixture: ${unexpected.join(", ")}`);
}

console.log(`Semgrep rule fixtures passed: ${EXPECTED_RULE_IDS.size} rules.`);

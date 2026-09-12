import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("production owner alerts", () => {
  it("keeps readiness local and sends only deduplicated safe issue codes", async () => {
    const script = await readFile("ops/monitoring/check-owner-alerts.sh", "utf8");

    expect(script).toContain("http://127.0.0.1:3000/api/health/ready");
    expect(script).toContain('"issues": issues');
    expect(script).toContain("last-issues.sha256");
    expect(script).toContain("curl --config -");
    expect(script).toContain("READINESS_PAYLOAD_INVALID");
    expect(script).toContain("any(char in sys.argv[1]");
    expect(script).toContain(String.raw`\"level\":\"error\"`);
    expect(script).not.toContain("--data-binary \"@$ready\"");
    expect(script).not.toContain("echo \"$ALERT_WEBHOOK_URL\"");
  });

  it("ships the alert timer and host script in the reviewed release", async () => {
    const build = await readFile("scripts/build-release.mjs", "utf8");
    const deploy = await readFile("scripts/deploy-production.mjs", "utf8");

    for (const file of [
      "ops/systemd/seo-monitor-alerts.service",
      "ops/systemd/seo-monitor-alerts.timer",
      "ops/monitoring/check-owner-alerts.sh",
    ]) {
      expect(build).toContain(file);
    }
    expect(deploy).toContain("systemctl enable --now");
    expect(deploy).toContain("seo-monitor-alerts.timer");
  });
});

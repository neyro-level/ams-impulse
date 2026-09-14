import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getPwaManifest } from "../src/platform/pwa/manifest.ts";

describe("PWA shell", () => {
  it("publishes an installable standalone manifest", () => {
    const value = getPwaManifest();
    expect(value).toMatchObject({ start_url: "/dashboard/", display: "standalone", theme_color: "#101720" });
    expect(value.icons).toEqual(expect.arrayContaining([expect.objectContaining({ sizes: "192x192" }), expect.objectContaining({ sizes: "512x512" })]));
  });

  it("caches only explicit static asset paths", async () => {
    const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
    expect(source).toContain('"/_next/static/"');
    expect(source).toContain('"/pwa-icon-192.png"');
    expect(source).toContain('"/pwa-icon-512.png"');
    expect(source).not.toContain('caches.match(event.request)');
    expect(source).toContain('request.mode === "navigate"');
    expect(source).toContain('request.headers.has("authorization")');
    expect(source).toContain('request.headers.has("cookie")');
    expect(source).not.toContain('"/api/"');
    expect(source).not.toContain('"/mcp"');
    expect(source).not.toContain('"/tools/"');
    expect(source).toContain('const CACHE_VERSION = `${CACHE_NAMESPACE}v3`');
    expect(source).toContain("IS_LOCAL_DEVELOPMENT");
  });
});

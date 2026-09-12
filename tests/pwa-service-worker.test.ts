import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type FetchListener = (event: { request: unknown; respondWith(value: Promise<unknown>): void }) => void;
type ActivateListener = (event: { waitUntil(value: Promise<unknown>): void }) => void;

async function loadWorker() {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const listeners = new Map<string, (event: never) => void>();
  const cache = { match: vi.fn(async () => undefined), put: vi.fn(async () => undefined) };
  const caches = { keys: vi.fn<() => Promise<string[]>>(async () => []), delete: vi.fn(async () => true), open: vi.fn(async () => cache) };
  const fetch = vi.fn(async () => ({ ok: true, type: "basic", headers: new Headers(), clone() { return this; } }));
  const self = {
    location: { origin: "https://impulse.test" },
    clients: { claim: vi.fn(async () => undefined) },
    skipWaiting: vi.fn(),
    addEventListener(type: string, listener: (event: never) => void) { listeners.set(type, listener); },
  };
  runInNewContext(source, { self, caches, fetch, URL });
  return { listeners, cache, caches, fetch, self };
}

function request(path: string, overrides: Partial<{ method: string; mode: string; headers: Headers }> = {}) {
  return { method: "GET", mode: "no-cors", headers: new Headers(), url: `https://impulse.test${path}`, ...overrides };
}

describe("PWA service worker cache boundary", () => {
  it("serves only immutable Next assets and exact approved icons through Cache Storage", async () => {
    const worker = await loadWorker();
    for (const path of ["/_next/static/chunks/app.js", "/pwa-icon-192.png", "/pwa-icon-512.png", "/ams-favicon.svg"]) {
      let response: Promise<unknown> | undefined;
      (worker.listeners.get("fetch") as FetchListener)({ request: request(path), respondWith(value) { response = value; } });
      await response;
    }
    expect(worker.caches.open).toHaveBeenCalledTimes(4);
    expect(worker.cache.put).toHaveBeenCalledTimes(4);
    expect(worker.fetch).toHaveBeenCalledWith(expect.anything(), { cache: "no-cache", credentials: "omit" });
  });

  it("never intercepts private, auth, API, MCP, OAuth, export or signed requests", async () => {
    const worker = await loadWorker();
    const blocked = ["/dashboard/", "/c/client/site", "/tools/research/id", "/api/auth/get-session", "/mcp", "/.well-known/oauth-authorization-server", "/consent", "/exports/report.csv", "/_next/static/chunks/app.js?signature=secret"];
    for (const path of blocked) {
      let intercepted = false;
      (worker.listeners.get("fetch") as FetchListener)({ request: request(path), respondWith() { intercepted = true; } });
      expect(intercepted, path).toBe(false);
    }
    for (const unsafe of [request("/_next/static/chunks/app.js", { mode: "navigate" }), request("/_next/static/chunks/app.js", { headers: new Headers({ cookie: "session=secret" }) }), request("/_next/static/chunks/app.js", { headers: new Headers({ authorization: "Bearer secret" }) })]) {
      let intercepted = false;
      (worker.listeners.get("fetch") as FetchListener)({ request: unsafe, respondWith() { intercepted = true; } });
      expect(intercepted).toBe(false);
    }
    expect(worker.caches.open).not.toHaveBeenCalled();
    expect(worker.fetch).not.toHaveBeenCalled();
  });

  it.each(["private", 'private="set-cookie"', "public, no-store"])(
    "does not store an allowed-path response that declares %s",
    async (cacheControl) => {
      const worker = await loadWorker();
      worker.fetch.mockResolvedValue({ ok: true, type: "basic", headers: new Headers({ "cache-control": cacheControl }), clone() { return this; } });
      let response: Promise<unknown> | undefined;
      (worker.listeners.get("fetch") as FetchListener)({ request: request("/_next/static/chunks/app.js"), respondWith(value) { response = value; } });
      await response;
      expect(worker.cache.put).not.toHaveBeenCalled();
    },
  );

  it("deletes only obsolete versions from its own cache namespace on activate", async () => {
    const worker = await loadWorker();
    worker.caches.keys.mockResolvedValue(["ams-static-v1", "ams-static-v2", "another-app-v1"]);
    let activation: Promise<unknown> | undefined;
    (worker.listeners.get("activate") as ActivateListener)({ waitUntil(value) { activation = value; } });
    await activation;
    expect(worker.caches.delete).toHaveBeenCalledTimes(1);
    expect(worker.caches.delete).toHaveBeenCalledWith("ams-static-v1");
    expect(worker.caches.delete).not.toHaveBeenCalledWith("another-app-v1");
    expect(worker.self.clients.claim).toHaveBeenCalledOnce();
  });
});

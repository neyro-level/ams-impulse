const CACHE_NAMESPACE = "ams-static-";
const CACHE_VERSION = `${CACHE_NAMESPACE}v3`;
const NEXT_STATIC_PREFIX = "/_next/static/";
const ALLOWED_STATIC_FILES = new Set(["/ams-favicon.svg", "/pwa-icon-192.png", "/pwa-icon-512.png"]);
const LOCAL_DEVELOPMENT_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const IS_LOCAL_DEVELOPMENT = LOCAL_DEVELOPMENT_HOSTS.has(self.location.hostname);

function isApprovedStaticRequest(request, url) {
  if (request.method !== "GET" || request.mode === "navigate") return false;
  if (url.origin !== self.location.origin || url.search || url.hash) return false;
  if (request.headers.has("authorization") || request.headers.has("cookie")) return false;
  return ALLOWED_STATIC_FILES.has(url.pathname) || url.pathname.startsWith(NEXT_STATIC_PREFIX);
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_NAMESPACE) && (IS_LOCAL_DEVELOPMENT || key !== CACHE_VERSION)).map((key) => caches.delete(key))))
      .then(() => (IS_LOCAL_DEVELOPMENT ? self.registration.unregister() : self.clients.claim())),
  );
});

self.addEventListener("fetch", (event) => {
  if (IS_LOCAL_DEVELOPMENT) return;

  const request = event.request;
  const url = new URL(request.url);
  if (!isApprovedStaticRequest(request, url)) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request, { cache: "no-cache", credentials: "omit" });
      const cacheControl = response.headers.get("cache-control") ?? "";
      const responseForbidsCache = /(?:^|,)\s*(?:private(?:\s*=|\s|,|$)|no-store(?:\s|,|$))/i.test(cacheControl);
      if (response.ok && response.type === "basic" && !responseForbidsCache && !response.headers.has("set-cookie")) await cache.put(request, response.clone());
      return response;
    }),
  );
});

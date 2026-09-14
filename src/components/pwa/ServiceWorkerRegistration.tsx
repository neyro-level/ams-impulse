"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    const secureContext = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (!secureContext || !("serviceWorker" in navigator)) return;

    const localDevelopment = process.env.NODE_ENV === "development" && (location.hostname === "localhost" || location.hostname === "127.0.0.1");
    if (localDevelopment) {
      void Promise.all([
        navigator.serviceWorker.getRegistrations().then((registrations) =>
          Promise.all(
            registrations
              .filter((registration) => {
                const scriptUrl = registration.active?.scriptURL ?? registration.waiting?.scriptURL ?? registration.installing?.scriptURL;
                return scriptUrl ? new URL(scriptUrl).pathname === "/sw.js" : false;
              })
              .map((registration) => registration.unregister()),
          ),
        ),
        caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("ams-static-")).map((key) => caches.delete(key)))),
      ]);
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  }, []);
  return null;
}

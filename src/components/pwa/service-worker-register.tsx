"use client";

import { useEffect } from "react";

// Registers the app-shell service worker once per mount. Runs only in
// production builds — dev hot-reloads and SW caching fight each other,
// and the SW's only MVP job is installability + offline launch, both
// of which are prod-only signals anyway.
//
// Set NEXT_PUBLIC_PWA_DEV=1 to exercise the SW locally against a
// `next start` run after `next build` — useful when debugging the
// manifest / icon wiring.

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const isDev = process.env.NODE_ENV !== "production";
    const devOptIn = process.env.NEXT_PUBLIC_PWA_DEV === "1";
    if (isDev && !devOptIn) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // Registration failures are non-fatal — the app still works
        // without the SW, and the error surfaces in DevTools when a
        // developer goes looking. Swallow it so it doesn't pollute
        // real user consoles.
      });
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js so the installed app opens offline. Production builds
 * only: in development it would serve stale cached pages while you edit.
 * Browsers allow service workers only on HTTPS or localhost.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Not fatal: the app works online without it.
    });
  }, []);
  return null;
}

"use client";

import { useEffect } from "react";

/** Registers /sw.js in production. Skipped in dev so cached chunks never fight with HMR. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((err) => {
      console.error("Service worker registration failed", err);
    });
  }, []);
  return null;
}

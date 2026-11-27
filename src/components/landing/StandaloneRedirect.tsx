"use client";

import { useEffect } from "react";

/** An installed app (home-screen launch) opened on "/" goes straight to the app. */
export function StandaloneRedirect() {
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) location.replace("/expenses");
  }, []);
  return null;
}

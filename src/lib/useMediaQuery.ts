"use client";

import { useSyncExternalStore } from "react";

/** Live `matchMedia` result. Server render / first hydration pass reports `false` (mobile-first). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Wide enough for list + inspector side by side (Tailwind `lg`). */
export const SPLIT_VIEW_QUERY = "(min-width: 1024px)";
/** Mouse / trackpad – enables right-click context menus. */
export const FINE_POINTER_QUERY = "(pointer: fine)";

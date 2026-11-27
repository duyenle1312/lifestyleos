import type { CSSProperties } from "react";

/** Staggers `[data-reveal]` items in a list: each one starts a little after the one before. */
export function revealDelay(index: number): CSSProperties {
  return { "--reveal-delay": `${index * 90}ms` } as CSSProperties;
}

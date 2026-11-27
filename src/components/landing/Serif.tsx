import type { ReactNode } from "react";

// The one accent phrase per heading: Instrument Serif italic (gold on dark bands).
export function Serif({ children, gold = false }: { children: ReactNode; gold?: boolean }) {
  return (
    <span
      className={`font-[family-name:var(--font-serif)] font-normal italic ${gold ? "text-[#e8c37a]" : ""}`}
    >
      {children}
    </span>
  );
}

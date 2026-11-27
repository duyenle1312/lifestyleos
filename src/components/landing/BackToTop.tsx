"use client";

import { ArrowUp } from "lucide-react";

// A plain "#" link jumps to the top without JavaScript; with it, scroll smoothly unless motion is reduced.
export function BackToTop() {
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
      className="group inline-flex items-center gap-1.5 py-1 font-semibold text-[#14161c] hover:text-[#cf9019]"
    >
      <ArrowUp aria-hidden="true" className="size-4 transition-transform group-hover:-translate-y-0.5" />
      Back to top
    </a>
  );
}

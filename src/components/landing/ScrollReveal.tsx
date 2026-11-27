"use client";

import { useEffect } from "react";

/**
 * Fades in every `[data-reveal]` element on the landing page as it scrolls into view.
 *
 * Content is only hidden once this has run (the `reveal-on` class on <html>), so without JavaScript, or with
 * reduced motion, everything is simply visible. Anything already on screen when it runs is marked revealed in
 * the same task, before the class goes on, so it never flashes out and back in.
 */
export function ScrollReveal() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    );

    for (const el of document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-revealed])")) {
      if (el.getBoundingClientRect().top < window.innerHeight) el.setAttribute("data-revealed", "");
      else observer.observe(el);
    }
    document.documentElement.classList.add("reveal-on");

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("reveal-on");
    };
  }, []);

  return null;
}

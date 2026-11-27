"use client";

import Image from "next/image";
import { useEffect, useReducer, useRef } from "react";
import { activeSlide, carouselReducer, initialCarousel, SLIDE_MS } from "./carousel";
import { PhoneFrame } from "./PhoneFrame";

// Phone shots from scripts/landing-screenshots.playwright.js, in the order of the app's story.
const SLIDES = [
  { src: "/landing/scan-hero.png", label: "Scan", alt: "The scan screen, ready to photograph a receipt" },
  {
    src: "/landing/scan-result.png",
    label: "Translated",
    alt: "A scanned Bulgarian receipt, each line shown in Bulgarian above its English name",
  },
  { src: "/landing/scan-added.png", label: "Added", alt: "A popup saying the expenses were added successfully" },
  { src: "/landing/expenses-month.png", label: "Expenses", alt: "The month's expenses, grouped by day" },
  { src: "/landing/shopping-location.png", label: "Shopping", alt: "The shopping list, grouped by shop" },
  { src: "/landing/pantry-expiry.png", label: "Pantry", alt: "The pantry sorted by expiry: expired, expiring soon, fresh" },
];

const reducer = carouselReducer(SLIDES.length);

export function HeroCarousel() {
  const [state, dispatch] = useReducer(reducer, initialCarousel);
  const active = activeSlide(state, SLIDES.length);
  const root = useRef<HTMLDivElement>(null);

  // Auto-advance, unless the visitor asked for reduced motion (re-checked if that setting changes).
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;
    const sync = () => {
      window.clearInterval(timer);
      timer = motion.matches ? undefined : window.setInterval(() => dispatch({ type: "tick" }), SLIDE_MS);
    };
    sync();
    motion.addEventListener("change", sync);
    return () => {
      window.clearInterval(timer);
      motion.removeEventListener("change", sync);
    };
  }, []);

  // Don't advance in a background tab.
  useEffect(() => {
    const onVisibility = () => dispatch({ type: document.hidden ? "pause" : "resume", reason: "hidden" });
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // The track: every slide plus a clone of the first, so the wrap keeps sliding the same way.
  const track = [...SLIDES, SLIDES[0]];

  return (
    <div
      ref={root}
      role="region"
      aria-roledescription="carousel"
      aria-label="Lifestyle OS app screens"
      className="flex flex-col items-center"
      onMouseEnter={() => dispatch({ type: "pause", reason: "hover" })}
      onMouseLeave={() => dispatch({ type: "resume", reason: "hover" })}
      onFocus={() => dispatch({ type: "pause", reason: "focus" })}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node | null)) dispatch({ type: "resume", reason: "focus" });
      }}
    >
      <PhoneFrame className="w-[200px] lg:w-[220px]" shadow="shadow-[0_30px_60px_rgba(0,0,0,0.18)]">
        <div
          className={`flex ${state.animate ? "transition-transform duration-500 ease-in-out" : ""}`}
          style={{ transform: `translateX(-${state.index * 100}%)` }}
          onTransitionEnd={(e) => {
            if (e.target === e.currentTarget) dispatch({ type: "transitionEnd" });
          }}
        >
          {track.map((slide, i) => {
            const clone = i === SLIDES.length;
            return (
              <div
                key={i}
                className="w-full shrink-0"
                aria-hidden={clone || i !== active ? true : undefined}
                role={clone ? undefined : "group"}
                aria-roledescription={clone ? undefined : "slide"}
                aria-label={clone ? undefined : `${i + 1} of ${SLIDES.length}: ${slide.label}`}
              >
                <Image
                  src={slide.src}
                  alt={clone ? "" : slide.alt}
                  width={780}
                  height={1520}
                  sizes="220px"
                  // Slide 0 is the hero image. The rest are fetched straight away at low priority:
                  // lazy loading never fires for slides clipped off to the side, so they'd slide in blank.
                  {...(i === 0 ? { preload: true } : { loading: "eager" as const, fetchPriority: "low" as const })}
                  className="block h-auto w-full"
                />
              </div>
            );
          })}
        </div>
      </PhoneFrame>

      <p aria-live="polite" className="mt-9 text-[13px] font-semibold tracking-[0.02em] text-[#14161c]">
        {SLIDES[active].label}
      </p>
      <div className="mt-1 flex">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.label}
            type="button"
            aria-label={`Show ${slide.label}`}
            aria-current={i === active ? "true" : undefined}
            onClick={() => dispatch({ type: "goto", index: i })}
            className="group grid size-6 place-items-center"
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-4 bg-[#14161c]" : "w-1.5 bg-[#14161c]/20 group-hover:bg-[#14161c]/40"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

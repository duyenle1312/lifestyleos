"use client";

import { useEffect, useReducer, useRef } from "react";
import { carouselReducer, initialCarousel, SLIDE_MS, slotOf } from "./carousel";
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

// Where each ring position sits, relative to the front phone's own width. The side phones are
// smaller, pushed out and angled in towards the front one; the rest wait out of sight behind it.
function placement(slot: number): { transform: string; opacity: number; zIndex: number; filter?: string } {
  if (slot === 0) return { transform: "translateX(0) scale(1) rotateY(0deg)", opacity: 1, zIndex: 3 };
  if (slot === 1 || slot === -1)
    return {
      transform: `translateX(${slot * 58}%) scale(0.8) rotateY(${slot * -24}deg)`,
      opacity: 1,
      zIndex: 2,
      filter: "brightness(0.94)",
    };
  return { transform: "translateX(0) scale(0.6) rotateY(0deg)", opacity: 0, zIndex: 1 };
}

export function HeroCarousel() {
  const [state, dispatch] = useReducer(reducer, initialCarousel);
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
      {/* The front phone sits in the flow and sets the size; the others are stacked on it. */}
      <div className="relative w-[180px] [perspective:1200px] sm:w-[200px] lg:w-[220px]">
        {SLIDES.map((slide, i) => {
          const slot = slotOf(i, state.index, SLIDES.length);
          const front = slot === 0;
          const side = slot === 1 || slot === -1;
          return (
            <div
              key={slide.src}
              aria-hidden={front ? undefined : true}
              onClick={side ? () => dispatch({ type: "goto", index: i }) : undefined}
              className={`${front ? "relative" : "absolute inset-x-0 top-0"} ${side ? "cursor-pointer" : ""} transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none`}
              style={placement(slot)}
            >
              <PhoneFrame
                src={slide.src}
                alt={front ? slide.alt : ""}
                width={780}
                height={1520}
                sizes="220px"
                // Slide 0 is the hero image. The others are transparent but on screen, so their
                // lazy images still load straight away and are ready before they come round.
                preload={i === 0}
                className="w-full"
                shadow={front ? "shadow-[0_30px_60px_rgba(0,0,0,0.18)]" : "shadow-[0_18px_40px_rgba(0,0,0,0.12)]"}
              />
            </div>
          );
        })}
      </div>

      <p aria-live="polite" className="mt-9 text-[13px] font-semibold tracking-[0.02em] text-[#14161c]">
        {SLIDES[state.index].label}
      </p>
      <div className="mt-1 flex">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.label}
            type="button"
            aria-label={`Show ${slide.label}`}
            aria-current={i === state.index ? "true" : undefined}
            onClick={() => dispatch({ type: "goto", index: i })}
            className="group grid size-6 place-items-center"
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                i === state.index ? "w-4 bg-[#14161c]" : "w-1.5 bg-[#14161c]/20 group-hover:bg-[#14161c]/40"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useReducer, useRef, useState } from "react";
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
  { src: "/landing/expenses-month.png", label: "Expenses", alt: "The month's expenses, grouped by day" },
  { src: "/landing/shopping-location.png", label: "Shopping List", alt: "The shopping list, grouped by shop" },
  { src: "/landing/pantry-expiry.png", label: "Pantry", alt: "The pantry sorted by expiry: expired, expiring soon, fresh" },
];

const reducer = carouselReducer(SLIDES.length);

// How far the fan tilts towards the mouse, at the edge of the window.
const TILT_DEG = 5;

export function HeroCarousel() {
  const [state, dispatch] = useReducer(reducer, initialCarousel);
  const root = useRef<HTMLDivElement>(null);
  const fan = useRef<HTMLDivElement>(null);
  // Off for the first paint so the phones rise into place (see .hero-stage in globals.css); on once mounted.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Tilt the fan a little towards the mouse, eased so it drifts rather than snaps. The animation
  // loop only runs while it's catching up, and not at all with reduced motion or without a mouse.
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;
    let target = { x: 0, y: 0 };
    const now = { x: 0, y: 0 };
    let frame = 0;
    const step = () => {
      now.x += (target.x - now.x) * 0.08;
      now.y += (target.y - now.y) * 0.08;
      if (fan.current) fan.current.style.transform = `rotateX(${now.y.toFixed(2)}deg) rotateY(${now.x.toFixed(2)}deg)`;
      frame = Math.abs(target.x - now.x) + Math.abs(target.y - now.y) > 0.01 ? requestAnimationFrame(step) : 0;
    };
    const onMove = (e: MouseEvent) => {
      target = {
        x: (e.clientX / window.innerWidth - 0.5) * 2 * TILT_DEG,
        y: -(e.clientY / window.innerHeight - 0.5) * 2 * TILT_DEG,
      };
      if (!frame) frame = requestAnimationFrame(step);
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

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
      <div className={`hero-stage w-[clamp(150px,46vw,200px)] md:w-[clamp(150px,16.5vw,240px)]`} data-ready={ready || undefined}>
        <div ref={fan} className="hero-parallax">
          {SLIDES.map((slide, i) => {
            const slot = slotOf(i, state.index, SLIDES.length);
            const front = slot === 0;
            const side = slot === 1 || slot === -1;
            return (
              <div
                key={slide.src}
                data-slot={slot}
                aria-hidden={front ? undefined : true}
                onClick={side ? () => dispatch({ type: "goto", index: i }) : undefined}
                className="hero-slot"
              >
                <div className="hero-float" data-float={i % 3}>
                  <PhoneFrame
                    src={slide.src}
                    alt={front ? slide.alt : ""}
                    width={780}
                    height={1520}
                    sizes="(min-width: 768px) 16.5vw, 46vw"
                    // Slide 0 is the hero image. The others are transparent but on screen, so their
                    // lazy images still load straight away and are ready before they come round.
                    preload={i === 0}
                    className="w-full"
                    shadow={front ? "shadow-[0_30px_60px_rgba(0,0,0,0.2)]" : "shadow-[0_18px_40px_rgba(0,0,0,0.14)]"}
                  />
                </div>
              </div>
            );
          })}
        </div>
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

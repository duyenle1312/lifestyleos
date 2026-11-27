// State for the hero's phone carousel, kept pure so it can be unit-tested without a DOM.
//
// The track holds the slides plus a clone of slide 0 at the end. Wrapping from the last slide
// slides forward onto the clone, then snaps (no transition) back to the real slide 0, so the
// motion is always right-to-left and never rewinds across every slide.

export const SLIDE_MS = 3500;

export type PauseReason = "hover" | "focus" | "hidden";

export interface CarouselState {
  /** 0..count; `count` means the clone of slide 0 at the end of the track. */
  index: number;
  /** false for the one render that snaps from the clone back to 0 without a transition. */
  animate: boolean;
  paused: PauseReason[];
}

export type CarouselAction =
  | { type: "tick" }
  | { type: "goto"; index: number }
  | { type: "transitionEnd" }
  | { type: "pause"; reason: PauseReason }
  | { type: "resume"; reason: PauseReason };

export const initialCarousel: CarouselState = { index: 0, animate: true, paused: [] };

export function carouselReducer(count: number) {
  return (s: CarouselState, a: CarouselAction): CarouselState => {
    switch (a.type) {
      case "tick":
        if (s.paused.length > 0 || s.index === count) return s;
        return { ...s, index: s.index + 1, animate: true };
      case "goto":
        if (a.index < 0 || a.index >= count) return s;
        return { ...s, index: a.index, animate: true };
      case "transitionEnd":
        return s.index === count ? { ...s, index: 0, animate: false } : { ...s, animate: true };
      case "pause":
        return s.paused.includes(a.reason) ? s : { ...s, paused: [...s.paused, a.reason] };
      case "resume":
        return { ...s, paused: s.paused.filter((r) => r !== a.reason) };
    }
  };
}

/** The real slide being shown: the clone counts as slide 0. */
export const activeSlide = (s: CarouselState, count: number) => s.index % count;

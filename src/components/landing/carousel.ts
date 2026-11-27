// State for the hero's rotating phones, kept pure so it can be unit-tested without a DOM.
//
// Three phones show at a time: the active slide in front, the previous one on the left and the
// next one on the right. Each tick rotates them, so the right-hand phone comes to the front.

export const SLIDE_MS = 3500;

export type PauseReason = "hover" | "focus" | "hidden";

export interface CarouselState {
  /** The slide on the front phone. */
  index: number;
  paused: PauseReason[];
}

export type CarouselAction =
  | { type: "tick" }
  | { type: "goto"; index: number }
  | { type: "pause"; reason: PauseReason }
  | { type: "resume"; reason: PauseReason };

export const initialCarousel: CarouselState = { index: 0, paused: [] };

export function carouselReducer(count: number) {
  return (s: CarouselState, a: CarouselAction): CarouselState => {
    switch (a.type) {
      case "tick":
        return s.paused.length > 0 ? s : { ...s, index: (s.index + 1) % count };
      case "goto":
        return a.index < 0 || a.index >= count ? s : { ...s, index: a.index };
      case "pause":
        return s.paused.includes(a.reason) ? s : { ...s, paused: [...s.paused, a.reason] };
      case "resume":
        return { ...s, paused: s.paused.filter((r) => r !== a.reason) };
    }
  };
}

/**
 * Where slide `i` sits when `active` is in front, going round the ring: 0 front, 1 right, -1 left,
 * anything further (±2, 3) is tucked out of sight behind the front phone.
 */
export function slotOf(i: number, active: number, count: number): number {
  const d = (i - active + count) % count;
  return d > count / 2 ? d - count : d;
}

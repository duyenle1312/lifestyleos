import { describe, expect, test } from "vitest";
import { carouselReducer, initialCarousel, slotOf } from "./carousel";

const r = carouselReducer(6);

describe("carouselReducer", () => {
  test("starts on slide 0", () => expect(initialCarousel.index).toBe(0));

  test("tick brings the next slide to the front", () => expect(r(initialCarousel, { type: "tick" }).index).toBe(1));

  test("tick wraps from the last slide to the first", () =>
    expect(r({ ...initialCarousel, index: 5 }, { type: "tick" }).index).toBe(0));

  test("tick does nothing while paused", () =>
    expect(r({ ...initialCarousel, paused: ["hover"] }, { type: "tick" }).index).toBe(0));

  test("goto brings that slide to the front", () => expect(r(initialCarousel, { type: "goto", index: 4 }).index).toBe(4));

  test("goto ignores out-of-range", () => {
    expect(r(initialCarousel, { type: "goto", index: 9 })).toBe(initialCarousel);
    expect(r(initialCarousel, { type: "goto", index: -1 })).toBe(initialCarousel);
  });

  test("stays paused until every reason clears", () => {
    let s = r(initialCarousel, { type: "pause", reason: "hover" });
    s = r(s, { type: "pause", reason: "hidden" });
    s = r(s, { type: "resume", reason: "hover" });
    expect(r(s, { type: "tick" }).index).toBe(0);
    s = r(s, { type: "resume", reason: "hidden" });
    expect(r(s, { type: "tick" }).index).toBe(1);
  });

  test("pausing twice for the same reason needs one resume", () => {
    let s = r(initialCarousel, { type: "pause", reason: "focus" });
    s = r(s, { type: "pause", reason: "focus" });
    s = r(s, { type: "resume", reason: "focus" });
    expect(s.paused).toEqual([]);
  });
});

describe("slotOf", () => {
  test("the active slide is in front", () => expect(slotOf(2, 2, 6)).toBe(0));
  test("the next slide is on the right", () => expect(slotOf(3, 2, 6)).toBe(1));
  test("the previous slide is on the left", () => expect(slotOf(1, 2, 6)).toBe(-1));
  test("wraps: slide 0 is right of the last slide", () => expect(slotOf(0, 5, 6)).toBe(1));
  test("wraps: the last slide is left of slide 0", () => expect(slotOf(5, 0, 6)).toBe(-1));
  test("slides further away are behind the front phone", () => {
    expect(slotOf(4, 1, 6)).toBe(3);
    expect(slotOf(3, 1, 6)).toBe(2);
    expect(slotOf(5, 1, 6)).toBe(-2);
  });
});

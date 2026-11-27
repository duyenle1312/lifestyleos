import { describe, expect, test } from "vitest";
import { activeSlide, carouselReducer, initialCarousel } from "./carousel";

const r = carouselReducer(6);

describe("carouselReducer", () => {
  test("tick advances one", () => expect(r(initialCarousel, { type: "tick" }).index).toBe(1));

  test("tick does nothing while paused", () =>
    expect(r({ ...initialCarousel, paused: ["hover"] }, { type: "tick" }).index).toBe(0));

  test("wraps forward via the clone", () => {
    const onClone = r({ ...initialCarousel, index: 5 }, { type: "tick" });
    expect(onClone).toMatchObject({ index: 6, animate: true });
    expect(activeSlide(onClone, 6)).toBe(0);
    expect(r(onClone, { type: "transitionEnd" })).toMatchObject({ index: 0, animate: false });
  });

  test("tick on the clone waits for the transition to end", () =>
    expect(r({ ...initialCarousel, index: 6 }, { type: "tick" }).index).toBe(6));

  test("transitionEnd elsewhere changes nothing but re-enables animation", () =>
    expect(r({ ...initialCarousel, index: 2, animate: false }, { type: "transitionEnd" })).toMatchObject({
      index: 2,
      animate: true,
    }));

  test("next tick after the snap animates again", () =>
    expect(r({ ...initialCarousel, index: 0, animate: false }, { type: "tick" })).toMatchObject({
      index: 1,
      animate: true,
    }));

  test("goto jumps", () => expect(r(initialCarousel, { type: "goto", index: 4 }).index).toBe(4));

  test("goto from the clone lands on the slide", () =>
    expect(r({ ...initialCarousel, index: 6 }, { type: "goto", index: 3 })).toMatchObject({ index: 3, animate: true }));

  test("goto ignores out-of-range", () => {
    expect(r(initialCarousel, { type: "goto", index: 9 }).index).toBe(0);
    expect(r(initialCarousel, { type: "goto", index: -1 }).index).toBe(0);
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

describe("activeSlide", () => {
  test("is the index on a real slide", () => expect(activeSlide({ ...initialCarousel, index: 3 }, 6)).toBe(3));
});

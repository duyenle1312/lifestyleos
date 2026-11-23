import { describe, expect, it } from "vitest";
import {
  bucketBounds, bucketSums, periodSum, pctChange, ratio, pct, eur, fmt, timeAgo, bucketStartDate,
} from "./stats";

const ones = Array(730).fill(1);

describe("bucketBounds", () => {
  it("30 days: one bucket per day", () => {
    const b = bucketBounds(30);
    expect(b).toHaveLength(30);
    expect(b[0]).toEqual([700, 701]);
    expect(b[29]).toEqual([729, 730]);
  });
  it("84 days: twelve 7-day buckets", () => {
    const b = bucketBounds(84);
    expect(b).toHaveLength(12);
    expect(b.every(([s, e]) => e - s === 7)).toBe(true);
    expect(b[11][1]).toBe(730);
  });
  it("365 days: twelve contiguous buckets", () => {
    const b = bucketBounds(365);
    expect(b).toHaveLength(12);
    expect(b[0][0]).toBe(365);
    expect(b[11][1]).toBe(730);
    expect(b.reduce((n, [s, e]) => n + e - s, 0)).toBe(365);
    for (let i = 1; i < 12; i++) expect(b[i][0]).toBe(b[i - 1][1]);
  });
});

describe("sums", () => {
  it("bucketSums", () => expect(bucketSums(ones, 84)).toEqual(Array(12).fill(7)));
  it("periodSum", () => {
    expect(periodSum(ones, 30)).toBe(30);
    expect(periodSum(ones, 365, 1)).toBe(365);
  });
});

describe("ratios and formatting", () => {
  it("pctChange / ratio / pct", () => {
    expect(pctChange(120, 100)).toBe(20);
    expect(pctChange(5, 0)).toBeNull();
    expect(ratio(1, 0)).toBeNull();
    expect(ratio(1, 4)).toBe(0.25);
    expect(pct(null)).toBe("—");
    expect(pct(0.638)).toBe("64%");
  });
  it("eur / fmt", () => {
    expect(eur(17056.4)).toBe("€17,056");
    expect(fmt(1234)).toBe("1,234");
  });
});

describe("timeAgo", () => {
  const now = "2026-11-23T12:00:00Z";
  const ago = (ms: number) => new Date(Date.parse(now) - ms).toISOString();
  it("formats each unit", () => {
    expect(timeAgo(ago(30e3), now)).toBe("just now");
    expect(timeAgo(ago(3 * 60e3), now)).toBe("3 min ago");
    expect(timeAgo(ago(2 * 3600e3), now)).toBe("2 h ago");
    expect(timeAgo(ago(5 * 86400e3), now)).toBe("5 days ago");
  });
});

describe("bucketStartDate", () => {
  it("index 729 is today, 0 is 729 days earlier, at local noon", () => {
    const d = bucketStartDate("2026-11-23", 729);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 23, 12]);
    const first = bucketStartDate("2026-11-23", 0);
    expect(first.getHours()).toBe(12);
    expect(Math.round((d.getTime() - first.getTime()) / 86400e3)).toBe(729);
  });
});

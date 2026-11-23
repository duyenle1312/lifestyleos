import type { Range, UsageStats } from "./types";

export const DAYS = 730;

const BUCKETS: Record<Range, number> = { 30: 30, 84: 12, 365: 12 };

// Bucket b of range R with N buckets covers day indices
// [730 - R + floor(b*R/N), 730 - R + floor((b+1)*R/N)); same formula as the SQL.
export function bucketBounds(range: Range): Array<[number, number]> {
  const n = BUCKETS[range];
  const base = DAYS - range;
  return Array.from({ length: n }, (_, b) => [
    base + Math.floor((b * range) / n),
    base + Math.floor(((b + 1) * range) / n),
  ]);
}

const sum = (series: number[], start: number, end: number) => {
  let total = 0;
  for (let i = start; i < end; i++) total += series[i] ?? 0;
  return total;
};

export function bucketSums(series: number[], range: Range): number[] {
  return bucketBounds(range).map(([s, e]) => sum(series, s, e));
}

// offset 0 = the latest `range` days, 1 = the `range` days before that.
export function periodSum(series: number[], range: Range, offset = 0): number {
  const end = DAYS - offset * range;
  return sum(series, end - range, end);
}

export function pctChange(cur: number, prev: number): number | null {
  return prev === 0 ? null : ((cur - prev) / prev) * 100;
}

export function ratio(n: number, d: number): number | null {
  return d === 0 ? null : n / d;
}

export function activeFor(stats: UsageStats, range: Range): number[] {
  const b = stats.activeBuckets;
  return range === 30 ? b.d30 : range === 84 ? b.w12 : b.m12;
}

// Day index (729 = today) to a Date at local noon, so DST shifts never change the day.
export function bucketStartDate(today: string, index: number): Date {
  const [y, m, d] = today.split("-").map(Number);
  return new Date(y, m - 1, d - (DAYS - 1 - index), 12);
}

const num = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export const fmt = (n: number): string => num.format(n);
export const eur = (n: number): string => `€${num.format(n)}`;
export const clamp01 = (r: number | null): number | null => (r === null ? null : Math.min(1, Math.max(0, r)));
export const pct = (r: number | null): string => (r === null ? "—" : `${Math.round(r * 100)}%`);

export function timeAgo(at: string, now: string): string {
  const mins = Math.floor((Date.parse(now) - Date.parse(at)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

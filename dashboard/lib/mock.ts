import { DAYS } from "./stats";
import type { UsageStats } from "./types";

const WEEKDAY = [0.72, 1.0, 1.02, 0.98, 1.12, 1.34, 1.22]; // Sun..Sat
const AVG_EUR = 21.7;

// Preview data for when no database is configured. Deterministic for a given `now`.
export function mockStats(now: Date): UsageStats {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Helsinki" }).format(now);
  const [y, m, d] = today.split("-").map(Number);
  const weekday = (i: number) => new Date(Date.UTC(y, m - 1, d - (DAYS - 1 - i))).getUTCDay();

  const gen = (base: number, growth: number, noise: number) =>
    Array.from({ length: DAYS }, (_, i) => {
      const t = i / DAYS;
      return Math.max(
        0,
        Math.round((base + growth * t) * WEEKDAY[weekday(i)] * (1 + (rnd() - 0.5) * noise)),
      );
    });

  const signups = Array.from({ length: DAYS }, (_, i) => (rnd() < 0.045 + (i / DAYS) * 0.03 ? 1 : 0));
  const active = gen(1.4, 5.4, 0.75);
  const expAdded = gen(1.5, 9.5, 1.1);
  const expDeleted = gen(0.1, 0.65, 1.8);
  const shopCreated = gen(0.6, 4.2, 1.15);
  const shopTicked = gen(0.4, 3.2, 1.15);
  const shopDeleted = gen(0.05, 0.45, 1.8);
  const invAdded = gen(0.15, 1.1, 1.8);
  const invDeleted = gen(0.02, 0.25, 1.8);
  const expEur = expAdded.map((count, i) =>
    count === 0 ? 0 : Math.round(count * AVG_EUR * (0.78 + 0.44 * Math.abs(Math.sin(i * 1.7 + 0.5)))),
  );

  const sum = (a: number[], from = 0, to = a.length) => a.slice(from, to).reduce((s, v) => s + v, 0);
  const bucket = (n: number, range: number) =>
    Array.from({ length: n }, (_, b) => {
      const base = DAYS - range;
      const s = base + Math.floor((b * range) / n);
      const e = base + Math.floor(((b + 1) * range) / n);
      const days = Math.max(1, e - s);
      return Math.max(1, Math.round(sum(active, s, e) / days) * (range === 30 ? 1 : 2));
    });

  const users = sum(signups) + 12;
  const activeBuckets = { d30: bucket(30, 30), w12: bucket(12, 84), m12: bucket(12, 365) };

  return {
    generatedAt: now.toISOString(),
    today,
    daily: { signups, expAdded, expDeleted, expEur, shopCreated, shopTicked, shopDeleted, invAdded, invDeleted },
    activeBuckets,
    totals: {
      users,
      active7: Math.min(users, Math.max(...activeBuckets.w12.slice(-1), 1)),
      active30: Math.min(users, Math.max(...activeBuckets.m12.slice(-1), 1)),
      expensesAllTime: sum(expAdded),
      expensesDeletedAllTime: sum(expDeleted),
      eurAllTime: sum(expEur),
      otherCurrencies: [
        { currency: "USD", amount: 1840 },
        { currency: "SEK", amount: 5230 },
      ],
      shoppingOpen: Math.round(users * 0.6),
      inventoryInStock: sum(invAdded) - sum(invDeleted),
      inventoryExpiring7: Math.round(users * 0.3),
      usersWithCustomCategories: Math.round(users * 0.35),
      usersWithCustomPaymentMethods: Math.round(users * 0.2),
      retentionD30: 0.42,
    },
    lastActivity: { at: new Date(now.getTime() - 4 * 60000).toISOString(), kind: "expense" },
  };
}

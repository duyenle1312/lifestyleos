// Mirrors the JSON returned by dashboard.usage_stats() (supabase/migrations/20261123120000_dashboard_stats.sql).
// Daily arrays have 730 entries; index 729 is today (Helsinki).
export type UsageStats = {
  generatedAt: string;
  today: string; // YYYY-MM-DD
  daily: {
    signups: number[];
    expAdded: number[];
    expDeleted: number[];
    expEur: number[];
    shopCreated: number[];
    shopTicked: number[];
    shopDeleted: number[];
    invAdded: number[];
    invDeleted: number[];
  };
  activeBuckets: { d30: number[]; w12: number[]; m12: number[] };
  totals: {
    users: number;
    active7: number;
    active30: number;
    expensesAllTime: number;
    expensesDeletedAllTime: number;
    eurAllTime: number;
    otherCurrencies: Array<{ currency: string; amount: number }>;
    shoppingOpen: number;
    inventoryInStock: number;
    inventoryExpiring7: number;
    usersWithCustomCategories: number;
    usersWithCustomPaymentMethods: number;
    retentionD30: number | null;
  };
  lastActivity: { at: string | null; kind: string | null };
};

export type Range = 30 | 84 | 365;

export type StatsResult =
  | { kind: "db"; stats: UsageStats; dbMs: number }
  | { kind: "mock"; stats: UsageStats }
  | { kind: "error"; reason: "connect" | "query" };

export type DailyKey = keyof UsageStats["daily"];

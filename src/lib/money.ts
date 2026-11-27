// Money helpers: expenses can be in different currencies, so amounts are never summed across them.
export type CurrencyTotal = { currency: string; amount: number; count: number };

type Row = { amount: number; currency: string };

const FALLBACK = "EUR";

/** The row's currency; a missing one counts as EUR. */
export const currencyOf = (row: { currency: string }): string => row.currency || FALLBACK;

/** Main-currency order: more entries first; ties go to EUR, then alphabetical by code. */
function byCountThenEur(a: { currency: string; count: number }, b: { currency: string; count: number }): number {
  if (a.count !== b.count) return b.count - a.count;
  if (a.currency === b.currency) return 0;
  if (a.currency === FALLBACK) return -1;
  if (b.currency === FALLBACK) return 1;
  return a.currency < b.currency ? -1 : 1;
}

/** Per-currency sums, most entries first (ties: EUR, then by code). A missing currency counts as EUR. */
export function totalsByCurrency(rows: Row[]): CurrencyTotal[] {
  const map = new Map<string, CurrencyTotal>();
  for (const row of rows) {
    const currency = currencyOf(row);
    const t = map.get(currency) ?? { currency, amount: 0, count: 0 };
    t.amount += row.amount;
    t.count += 1;
    map.set(currency, t);
  }
  return [...map.values()]
    .map((t) => ({ ...t, amount: Math.round(t.amount * 100) / 100 }))
    .sort(byCountThenEur);
}

/** The currency with the most entries; ties go to EUR if present, else alphabetical. EUR when empty. */
export function mainCurrency(rows: Row[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(currencyOf(row), (counts.get(currencyOf(row)) ?? 0) + 1);
  const entries = [...counts].map(([currency, count]) => ({ currency, count })).sort(byCountThenEur);
  return entries[0]?.currency ?? FALLBACK;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch (e) {
    if (e instanceof RangeError) return `${amount.toFixed(2)} ${currency}`;
    throw e;
  }
}

export function formatTotals(totals: CurrencyTotal[]): string {
  if (totals.length === 0) return formatMoney(0, "EUR");
  return totals.map((t) => formatMoney(t.amount, t.currency)).join(" · ");
}

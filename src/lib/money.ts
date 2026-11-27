// Money helpers: expenses can be in different currencies, so amounts are never summed across them.
export type CurrencyTotal = { currency: string; amount: number; count: number };

type Row = { amount: number; currency: string };

const FALLBACK = "EUR";
const cur = (c: string | null | undefined) => c || FALLBACK;

/** Per-currency sums, largest first (ties by code). A missing currency counts as EUR. */
export function totalsByCurrency(rows: Row[]): CurrencyTotal[] {
  const map = new Map<string, CurrencyTotal>();
  for (const row of rows) {
    const currency = cur(row.currency);
    const t = map.get(currency) ?? { currency, amount: 0, count: 0 };
    t.amount += row.amount;
    t.count += 1;
    map.set(currency, t);
  }
  return [...map.values()]
    .map((t) => ({ ...t, amount: Math.round(t.amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount || a.currency.localeCompare(b.currency));
}

/** The currency with the most entries; ties go to EUR if present, else alphabetical. EUR when empty. */
export function mainCurrency(rows: Row[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(cur(row.currency), (counts.get(cur(row.currency)) ?? 0) + 1);
  let best = FALLBACK;
  let bestCount = 0;
  for (const [currency, count] of counts) {
    const wins =
      count > bestCount ||
      (count === bestCount && best !== FALLBACK && (currency === FALLBACK || currency < best));
    if (wins) {
      best = currency;
      bestCount = count;
    }
  }
  return best;
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

// Ports of Config/Helpers.swift plus the date/format helpers scattered across the iOS views.

/**
 * Port of `Decimal.fromString`: accepts "1.5", "1,5", "1.234,50", "1,234.50".
 * When both separators appear, the last one is the decimal separator.
 */
export function parseDecimal(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const lastDot = trimmed.lastIndexOf(".");
  const lastComma = trimmed.lastIndexOf(",");
  let normalized = trimmed;

  if (lastDot >= 0 && lastComma >= 0) {
    normalized =
      lastDot > lastComma
        ? trimmed.replace(/,/g, "")
        : trimmed.replace(/\./g, "").replace(",", ".");
  } else if (lastComma >= 0) {
    normalized = trimmed.replace(/,/g, ".");
  }

  if (!/^[-+]?\d*\.?\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Swift's `Int(string)` – only a plain integer string parses. */
export function parseIntStrict(input: string): number | null {
  const t = input.trim();
  return /^[-+]?\d+$/.test(t) ? Number(t) : null;
}

export const toFixed2 = (n: number) => n.toFixed(2);

/** NumberFormatter .decimal with max 2 fraction digits (used for quantities). */
export const formatQuantity = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });

// MARK: - Dates

/** "YYYY-MM-DD" in local time – the value format of <input type="date">. */
export function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Port of `Calendar.noon(for:)`: local noon of the picked day, as ISO for Supabase. */
export function noonISO(dateInput: string): string {
  const [y, m, d] = dateInput.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

export const todayInput = () => toDateInput(new Date());

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Like `Calendar.date(byAdding: .month)` – clamps the day (Jan 31 + 1 → Feb 28). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

export const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const isSameMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

export const isPast = (d: Date) => d.getTime() < Date.now();
export const isToday =(d: Date) => isSameDay(d, new Date());
export const isYesterday = (d: Date) => isSameDay(d, addDays(new Date(), -1));
export const isTomorrow = (d: Date) => isSameDay(d, addDays(new Date(), 1));

/** `Calendar.dateComponents([.day], from: now, to: date).day` – whole days, truncated toward zero. */
export const daysUntil = (date: Date) => Math.trunc((date.getTime() - Date.now()) / 86_400_000);

const fmt = (date: Date, opts: Intl.DateTimeFormatOptions) => date.toLocaleDateString("en-US", opts);

/** "MMMM yyyy" */
export const formatMonthYear = (d: Date) => fmt(d, { month: "long", year: "numeric" });
/** "MMM d" */
export const formatMonthDay = (d: Date) => fmt(d, { month: "short", day: "numeric" });
/** "MMM d, yyyy" */
export const formatMonthDayYear = (d: Date) => fmt(d, { month: "short", day: "numeric", year: "numeric" });
/** DateFormatter .medium */
export const formatMedium = (d: Date) => fmt(d, { dateStyle: "medium" } as Intl.DateTimeFormatOptions);
/** "dd/MM/yyyy" */
export const formatDMY = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
/** `Date.formatted()` – short date + time */
export const formatDateTime = (d: Date) =>
  d.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" } as Intl.DateTimeFormatOptions);

/** Expense list section headers: Today / Yesterday / "EEEE, MMM d" (+ ", yyyy" for other years). */
export function formatSectionDate(d: Date): string {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return fmt(d, { weekday: "long", month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

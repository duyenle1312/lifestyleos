// Expiration rules shared by the inventory list and row (21-day "expiring soon" window).
import type { IOSColor } from "./constants";
import { daysUntil, formatMonthDayYear } from "./helpers";
import type { InventoryItem } from "./types";

export const EXPIRING_WINDOW_DAYS = 21;

export type ExpiryStatus = "none" | "expired" | "expiring" | "fresh";

export function expiryStatus(item: InventoryItem): ExpiryStatus {
  if (!item.expiration_date) return "none";
  const date = new Date(item.expiration_date);
  if (date.getTime() < Date.now()) return "expired";
  return daysUntil(date) <= EXPIRING_WINDOW_DAYS ? "expiring" : "fresh";
}

export const isExpired = (i: InventoryItem) => expiryStatus(i) === "expired";

/**
 * A plain 0 ≤ days ≤ 21 test would also match items that expired earlier today (days truncates to 0),
 * so they would show up as both expired and expiring. Expired items are excluded here.
 */
export const isExpiringSoon = (i: InventoryItem) => expiryStatus(i) === "expiring";

export const STATUS_COLOR: Record<ExpiryStatus, IOSColor> = {
  none: "blue",
  expired: "red",
  expiring: "orange",
  fresh: "green",
};

export function expirationText(date: Date): string {
  const days = daysUntil(date);
  if (date.getTime() < Date.now()) {
    const n = Math.abs(days);
    return `Expired ${n} day${n === 1 ? "" : "s"} ago`;
  }
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  if (days <= 7) return `Expires within 1 week in ${days} days`;
  if (days <= EXPIRING_WINDOW_DAYS) return `Expires in ${days} days`;
  return formatMonthDayYear(date);
}

// Text for the sync badge: what the pill says and how a failed outbox entry is named.
import type { OutboxEntry } from "./db";

export const plural = (n: number) => `${n} change${n === 1 ? "" : "s"}`;

/** Names a failed entry by what the user typed (the item), falling back to the kind of row. */
export function describeEntry(e: OutboxEntry): string {
  if (e.op === "upsertMany") {
    const n = Array.isArray(e.payload) ? e.payload.length : 0;
    return `Receipt (${n} item${n === 1 ? "" : "s"})`;
  }
  const kind = e.table === "expenses" ? "Expense" : "Shopping item";
  if (e.op === "delete") return `${kind} delete`;
  const item = (e.payload as Record<string, unknown>).item;
  return typeof item === "string" && item.trim() ? item.trim() : `${kind} save`;
}

export type BadgeState = "failed" | "offline" | "syncing" | "waiting" | null;

/**
 * Which pill to show. "Syncing…" only while changes are being sent or the very first pull is still running,
 * so routine background pulls stay silent; offline with nothing queued just says "Offline".
 */
export function badgeLabel(s: { online: boolean; syncing: boolean; pending: number; failed: number; awaitingFirstPull: boolean }): {
  state: BadgeState;
  label: string | null;
} {
  if (s.failed > 0) return { state: "failed", label: `${plural(s.failed)} couldn't sync` };
  if (!s.online) return { state: "offline", label: s.pending > 0 ? `Offline · ${plural(s.pending)} waiting` : "Offline" };
  if (s.pending > 0) return s.syncing ? { state: "syncing", label: "Syncing…" } : { state: "waiting", label: `${plural(s.pending)} waiting` };
  if (s.syncing && s.awaitingFirstPull) return { state: "syncing", label: "Syncing…" };
  return { state: null, label: null };
}

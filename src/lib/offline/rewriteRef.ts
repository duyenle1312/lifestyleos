import type { LocalDb } from "./db";

type Payload = Record<string, unknown>;

/**
 * Repoints `field` from `fromId` to `toId` (null clears it) inside queued expense writes, so a push after
 * delete-and-move does not hit a foreign-key violation. Must run inside a transaction that includes `db.outbox`.
 */
export async function rewriteRefInOutbox(
  db: LocalDb,
  field: "category_id" | "payment_method_id",
  fromId: string,
  toId: string | null,
): Promise<void> {
  const fix = (row: Payload): Payload => (row[field] === fromId ? { ...row, [field]: toId } : row);
  for (const entry of await db.outbox.toArray()) {
    if (entry.table !== "expenses" || entry.op === "delete") continue;
    const payload = Array.isArray(entry.payload) ? entry.payload.map(fix) : fix(entry.payload);
    const changed = Array.isArray(payload)
      ? payload.some((r, i) => r !== (entry.payload as Payload[])[i])
      : payload !== entry.payload;
    if (changed) await db.outbox.update(entry.seq!, { payload });
  }
}

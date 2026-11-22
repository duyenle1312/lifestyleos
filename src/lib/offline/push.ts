// Sends the outbox to the server, oldest first, one entry at a time.
import type { Expense, ShoppingItem } from "../types";
import { type LocalDb, type OutboxEntry, toLocalExpense } from "./db";
import { type Remote, isRetryable } from "./remote";

export type PushResult = { sent: number; failed: number; notices: string[] };

type Row = Record<string, unknown>;

const RESTORED_NOTICE = "1 item restored — it had been deleted on another device";

const messageOf = (e: unknown) => (e instanceof Error ? e.message : typeof e === "object" && e !== null && "message" in e ? String((e as { message: unknown }).message) : String(e));

const toServerRow = ({ updated_at, ...row }: Row): Row => {
  void updated_at;
  return { ...row, deleted_at: null };
};

type Restore = { deleted_at: unknown; restored_at: string };

/**
 * Merges the server's metadata underneath the local payload's, so server-only keys survive.
 * `restored_after_delete` is a union: server entries, then unseen local ones, then this push's restore (if any).
 */
function mergeMetadata(row: Row, server: Row, restore: Restore | null): Row {
  const serverMeta = (server.metadata ?? {}) as Row;
  const localMeta = (row.metadata ?? {}) as Row;
  const listOf = (m: Row) => (Array.isArray(m.restored_after_delete) ? (m.restored_after_delete as Restore[]) : []);
  const seen = new Set<string>();
  const history = [...listOf(serverMeta), ...listOf(localMeta), ...(restore ? [restore] : [])].filter((r) => {
    const key = `${r.deleted_at}|${r.restored_at}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const metadata = { ...serverMeta, ...localMeta, ...(history.length ? { restored_after_delete: history } : {}) };
  return { ...row, metadata };
}

/** Row ids an entry touches, used to hold back later entries behind a failed one. */
const rowIdsOf = (e: OutboxEntry): string[] =>
  e.op === "upsertMany" ? (e.payload as Row[]).map((r) => r.id as string) : e.rowId ? [e.rowId] : [];

const nullRefs = (rows: Row[]): Row[] => rows.map((r) => ({ ...r, category_id: null, payment_method_id: null }));

/** Marks the entry as in flight (attempts > 0) so later edits queue separately; returns the fresh entry. */
function markInFlight(db: LocalDb, seq: number): Promise<OutboxEntry | undefined> {
  return db.transaction("rw", db.outbox, async () => {
    const cur = await db.outbox.get(seq);
    if (!cur) return undefined;
    await db.outbox.update(seq, { attempts: cur.attempts + 1 });
    return { ...cur, attempts: cur.attempts + 1 };
  });
}

/** Deletes the sent entry and stores the server's rows, except where a newer queued entry holds a newer local edit. */
function applySuccess(db: LocalDb, entry: OutboxEntry, returned: Row[]): Promise<void> {
  return db.transaction("rw", [db.outbox, db.expenses, db.shoppingItems], async () => {
    await db.outbox.delete(entry.seq!);
    for (const row of returned) {
      const id = row.id as string;
      const newer = (await db.outbox.where("rowId").equals(id).toArray()).some((e) => e.table === entry.table);
      if (newer) continue;
      if (entry.table === "expenses") await db.expenses.put(toLocalExpense(row as unknown as Expense));
      else await db.shoppingItems.put(row as unknown as ShoppingItem);
    }
  });
}

async function send(entry: OutboxEntry, remote: Remote, notices: string[]): Promise<Row[]> {
  if (entry.op === "delete") {
    await remote.softDelete(entry.table, entry.rowId!);
    return [];
  }
  const now = new Date().toISOString();
  let rows: Row[];
  let restored = 0;
  if (entry.op === "upsertMany") {
    rows = (entry.payload as Row[]).map(toServerRow);
  } else {
    let row = toServerRow(entry.payload as Row);
    const server = (await remote.fetchRow(entry.table, entry.rowId!)) as Row | null;
    if (server) {
      const wasDeleted = Boolean(server.deleted_at);
      row = mergeMetadata(row, server, wasDeleted ? { deleted_at: server.deleted_at, restored_at: now } : null);
      restored = wasDeleted ? 1 : 0;
    }
    rows = [row];
  }
  let returned: Row[];
  try {
    returned = (await remote.upsert(entry.table, rows)) as Row[];
  } catch (e) {
    if ((e as { code?: string } | null)?.code !== "23503") throw e;
    returned = (await remote.upsert(entry.table, nullRefs(rows))) as Row[];
  }
  if (restored) notices.push(RESTORED_NOTICE);
  return returned;
}

export async function pushOutbox(db: LocalDb, remote: Remote): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, notices: [] };
  const entries = await db.outbox.orderBy("seq").toArray();
  const blocked = new Set<string>();

  for (const snapshot of entries) {
    if (snapshot.status === "failed") {
      rowIdsOf(snapshot).forEach((id) => blocked.add(id));
      continue;
    }
    if (rowIdsOf(snapshot).some((id) => blocked.has(id))) continue;

    const entry = await markInFlight(db, snapshot.seq!);
    if (!entry) continue;
    try {
      const returned = await send(entry, remote, result.notices);
      // If this throws after the remote succeeded, the entry stays queued and is re-sent next push; upserts are idempotent.
      await applySuccess(db, entry, returned);
      result.sent++;
    } catch (e) {
      if (isRetryable(e)) break;
      await db.outbox.update(entry.seq!, { status: "failed", error: messageOf(e) });
      rowIdsOf(entry).forEach((id) => blocked.add(id));
      result.failed++;
    }
  }
  return result;
}

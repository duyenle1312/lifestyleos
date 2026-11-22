// Brings server changes into the local database.
import type { Category, Expense, InventoryItem, PaymentMethod, ShoppingItem } from "../types";
import { type LocalDb, type OutboxEntry, toLocalExpense } from "./db";
import type { PullTable, Remote } from "./remote";

type Row = Record<string, unknown>;

export const cursorKey = (table: PullTable) => `cursor:${table}`;

/** Row ids with a queued change for a table, receipts included. Those rows are local-wins until sent. */
export const queuedIds = (entries: OutboxEntry[], table: string): Set<string> => {
  const ids = new Set<string>();
  for (const e of entries) {
    if (e.table !== table) continue;
    if (e.op === "upsertMany") (e.payload as Row[]).forEach((r) => ids.add(r.id as string));
    else if (e.rowId) ids.add(e.rowId);
  }
  return ids;
};

const PULLED: PullTable[] = ["expenses", "shopping_lists", "inventory_items"];

export async function deleteLocal(db: LocalDb, table: PullTable, id: string): Promise<void> {
  if (table === "expenses") await db.expenses.delete(id);
  else if (table === "shopping_lists") await db.shoppingItems.delete(id);
  else await db.inventoryItems.delete(id);
}

/** Stores (or, when soft-deleted, removes) a server row locally. */
export async function applyServerRow(db: LocalDb, table: PullTable, row: Row): Promise<void> {
  if (row.deleted_at) await deleteLocal(db, table, row.id as string);
  else if (table === "expenses") await db.expenses.put(toLocalExpense(row as unknown as Expense));
  else if (table === "shopping_lists") await db.shoppingItems.put(row as unknown as ShoppingItem);
  else await db.inventoryItems.put(row as unknown as InventoryItem);
}

/** Rows from another account (a stale response after a user switch) are never stored. */
const ownRows = (rows: Row[], userId: string) => rows.filter((r) => r.account_id === undefined || r.account_id === userId);

async function pullTable(db: LocalDb, remote: Remote, table: PullTable, userId: string, stopped: () => boolean): Promise<void> {
  const key = cursorKey(table);
  const cursor = ((await db.meta.get(key))?.value as string | undefined) ?? null;
  const fetched = (await remote.fetchChangedSince(table, cursor)) as Row[];
  if (stopped()) return;
  const rows = ownRows(fetched, userId);
  if (!rows.length) return;
  const stores = [db.outbox, db.meta, db.expenses, db.shoppingItems, db.inventoryItems];
  await db.transaction("rw", stores, async () => {
    const skip = queuedIds(await db.outbox.toArray(), table);
    let max = cursor;
    for (const row of rows) {
      const at = row.updated_at as string | undefined;
      if (at && (max === null || at > max)) max = at;
      if (!skip.has(row.id as string)) await applyServerRow(db, table, row);
    }
    if (max !== null) await db.meta.put({ key, value: max });
  });
}

export async function pullAll(db: LocalDb, remote: Remote, userId: string, stopped: () => boolean = () => false): Promise<void> {
  for (const table of PULLED) {
    if (stopped()) return;
    await pullTable(db, remote, table, userId, stopped);
  }
  // Reference tables are small: replace them wholesale. The account id equals the user id for the owner link.
  if (stopped()) return;
  const categories = ownRows((await remote.fetchAll("categories", userId)) as Row[], userId) as unknown as Category[];
  const methods = ownRows((await remote.fetchAll("payment_methods", userId)) as Row[], userId) as unknown as PaymentMethod[];
  if (stopped()) return;
  await db.transaction("rw", [db.categories, db.paymentMethods], async () => {
    // An empty answer while local rows exist is more likely a bad response than a real wipe: keep what we have.
    if (categories.length || !(await db.categories.count())) {
      await db.categories.clear();
      await db.categories.bulkPut(categories);
    }
    if (methods.length || !(await db.paymentMethods.count())) {
      await db.paymentMethods.clear();
      await db.paymentMethods.bulkPut(methods);
    }
  });
}

// Offline-first writes: each one updates the local row and queues it for sync in a single transaction.
import type { Expense, ShoppingItem } from "../types";
import type { ExpenseInput, ShoppingInput } from "../services";
import { type LocalDb, type LocalExpense, type OutboxEntry, toLocalExpense } from "./db";

type NewEntry = Pick<OutboxEntry, "table" | "op" | "rowId" | "payload">;

/** Drops keys whose value is `undefined` so merging a Partial never erases existing fields. */
const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/**
 * Queues a change. Does a read-modify-write, so callers must already be inside a `rw` transaction
 * covering `outbox` (and the row's table); not exported for use outside this module's mutations.
 *
 *  Collapse rules (only touching `pending` entries never tried yet):
 * an upsert merges into an existing upsert for the same row (later fields win);
 * a delete replaces that row's pending upserts with a single delete.
 */
async function enqueue(db: LocalDb, entry: NewEntry): Promise<void> {
  if (entry.rowId !== null && entry.op !== "upsertMany") {
    const fresh = (await db.outbox.where("rowId").equals(entry.rowId).toArray()).filter(
      (e) => e.table === entry.table && e.status === "pending" && e.attempts === 0 && e.op === "upsert",
    );
    if (entry.op === "upsert" && fresh.length > 0) {
      const target = fresh[fresh.length - 1];
      await db.outbox.update(target.seq!, { payload: { ...(target.payload as Record<string, unknown>), ...(entry.payload as Record<string, unknown>) } });
      return;
    }
    if (entry.op === "delete" && fresh.length > 0) {
      await db.outbox.bulkDelete(fresh.map((e) => e.seq!));
    }
  }
  await db.outbox.add({ ...entry, createdAt: Date.now(), attempts: 0, status: "pending", error: null });
}

const withoutTs = ({ _ts, ...row }: LocalExpense) => {
  void _ts;
  return row as Record<string, unknown>;
};

function buildExpense(userId: string, input: ExpenseInput, now: string, id?: string): Expense {
  return {
    id: id ?? crypto.randomUUID(),
    account_id: userId,
    created_by_user_id: userId,
    metadata: {},
    deleted_at: null,
    created_at: now,
    updated_at: now,
    ...input,
  };
}

export function saveExpense(db: LocalDb, userId: string, input: ExpenseInput, id?: string): Promise<LocalExpense> {
  return db.transaction("rw", db.expenses, db.outbox, async () => {
    const now = new Date().toISOString();
    const existing = id ? await db.expenses.get(id) : undefined;
    const row = toLocalExpense(
      existing ? { ...existing, ...defined(input), updated_at: now } : buildExpense(userId, input, now, id),
    );
    await db.expenses.put(row);
    await enqueue(db, { table: "expenses", op: "upsert", rowId: row.id, payload: withoutTs(row) });
    return row;
  });
}

export function deleteExpense(db: LocalDb, id: string): Promise<void> {
  return db.transaction("rw", db.expenses, db.outbox, async () => {
    await db.expenses.delete(id);
    await enqueue(db, { table: "expenses", op: "delete", rowId: id, payload: {} });
  });
}

export function saveShoppingItem(db: LocalDb, userId: string, input: Partial<ShoppingInput>, id?: string): Promise<ShoppingItem> {
  return db.transaction("rw", db.shoppingItems, db.outbox, async () => {
    const now = new Date().toISOString();
    const existing = id ? await db.shoppingItems.get(id) : undefined;
    let row: ShoppingItem;
    if (existing) {
      row = { ...existing, ...defined(input), updated_at: now };
    } else {
      if (input.item === undefined) throw new Error("A new shopping item needs an item name");
      row = {
        id: id ?? crypto.randomUUID(),
        account_id: userId,
        created_by_user_id: userId,
        metadata: {},
        deleted_at: null,
        created_at: now,
        updated_at: now,
        description: null,
        location: null,
        available_date_start: null,
        available_date_end: null,
        unit_price: null,
        quantity: null,
        purchased: false,
        scheduled_date: null,
        priority: null,
        ...defined(input),
        item: input.item,
      };
    }
    await db.shoppingItems.put(row);
    await enqueue(db, { table: "shopping_lists", op: "upsert", rowId: row.id, payload: { ...row } });
    return row;
  });
}

export function deleteShoppingItem(db: LocalDb, id: string): Promise<void> {
  return db.transaction("rw", db.shoppingItems, db.outbox, async () => {
    await db.shoppingItems.delete(id);
    await enqueue(db, { table: "shopping_lists", op: "delete", rowId: id, payload: {} });
  });
}

/** Saves all receipt lines locally and queues them as one bulk upsert. */
export function saveReceipt(db: LocalDb, userId: string, rows: ExpenseInput[]): Promise<LocalExpense[]> {
  return db.transaction("rw", db.expenses, db.outbox, async () => {
    const now = new Date().toISOString();
    const saved = rows.map((input) => toLocalExpense(buildExpense(userId, input, now)));
    await db.expenses.bulkPut(saved);
    await enqueue(db, { table: "expenses", op: "upsertMany", rowId: null, payload: saved.map(withoutTs) });
    return saved;
  });
}

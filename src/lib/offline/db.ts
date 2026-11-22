// Per-user on-device database (IndexedDB via Dexie): a copy of the user's data plus the outbox of unsynced changes.
import Dexie, { type EntityTable } from "dexie";
import type { Category, Expense, InventoryItem, PaymentMethod, ShoppingItem } from "../types";

/** An expense plus its parsed `expense_date` in ms, indexed for month-range queries. */
export type LocalExpense = Expense & { _ts: number };

export type OutboxEntry = {
  seq?: number;
  table: "expenses" | "shopping_lists";
  op: "upsert" | "delete" | "upsertMany";
  rowId: string | null;
  payload: Record<string, unknown> | Record<string, unknown>[];
  createdAt: number;
  attempts: number;
  status: "pending" | "failed";
  error: string | null;
};

export type MetaEntry = { key: string; value: unknown };

export class LocalDb extends Dexie {
  expenses!: EntityTable<LocalExpense, "id">;
  shoppingItems!: EntityTable<ShoppingItem, "id">;
  inventoryItems!: EntityTable<InventoryItem, "id">;
  categories!: EntityTable<Category, "id">;
  paymentMethods!: EntityTable<PaymentMethod, "id">;
  outbox!: EntityTable<OutboxEntry, "seq">;
  meta!: EntityTable<MetaEntry, "key">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      expenses: "id, _ts",
      shoppingItems: "id",
      inventoryItems: "id",
      categories: "id",
      paymentMethods: "id",
      outbox: "++seq, rowId, status",
      meta: "key",
    });
  }
}

export const openUserDb = (userId: string) => new LocalDb(`lifestyleos-${userId}`);

export const toLocalExpense = (row: Expense): LocalExpense => ({ ...row, _ts: Date.parse(row.expense_date) });

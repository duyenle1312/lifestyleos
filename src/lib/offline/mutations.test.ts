import { beforeEach, describe, expect, it } from "vitest";
import { type LocalDb, openUserDb, toLocalExpense } from "./db";
import { deleteExpense, deleteShoppingItem, saveExpense, saveReceipt, saveShoppingItem } from "./mutations";
import type { ExpenseInput } from "../services";
import type { Expense } from "../types";

const input = (over: Partial<ExpenseInput> = {}): ExpenseInput => ({
  amount: 5, currency: "EUR", expense_date: "2026-11-10T12:00:00.000Z", category_id: null, description: null,
  location: null, unit: null, unit_price: null, expire_date: null, payment_method_id: null, item: "Milk", ...over,
});

let db: LocalDb;
let n = 0;
beforeEach(() => { db = openUserDb(`u${++n}-${Math.random()}`); });

describe("saveExpense", () => {
  it("creates a local row with uuid id and one upsert entry", async () => {
    const row = await saveExpense(db, "u", input());
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row).toMatchObject({ account_id: "u", created_by_user_id: "u", metadata: {}, deleted_at: null, _ts: Date.parse("2026-11-10T12:00:00.000Z") });
    expect(await db.expenses.get(row.id)).toEqual(row);
    const out = await db.outbox.toArray();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ table: "expenses", op: "upsert", rowId: row.id, status: "pending", attempts: 0 });
    expect(out[0].payload).not.toHaveProperty("_ts");
  });

  it("editing twice before sync leaves one entry with the second values", async () => {
    const row = await saveExpense(db, "u", input());
    await saveExpense(db, "u", input({ amount: 7 }), row.id);
    await saveExpense(db, "u", input({ amount: 9, item: "Oat milk" }), row.id);
    const out = await db.outbox.toArray();
    expect(out).toHaveLength(1);
    expect(out[0].payload).toMatchObject({ id: row.id, amount: 9, item: "Oat milk" });
    expect((await db.expenses.get(row.id))?.amount).toBe(9);
  });

  it("an edit after a sync attempt is a separate entry", async () => {
    const row = await saveExpense(db, "u", input());
    await db.outbox.toCollection().modify({ attempts: 1 });
    await saveExpense(db, "u", input({ amount: 8 }), row.id);
    expect(await db.outbox.count()).toBe(2);
  });
});

describe("deleteExpense", () => {
  it("on a pending-create row leaves a single delete", async () => {
    const row = await saveExpense(db, "u", input());
    await saveExpense(db, "u", input({ amount: 6 }), row.id);
    await deleteExpense(db, row.id);
    expect(await db.expenses.get(row.id)).toBeUndefined();
    const out = await db.outbox.toArray();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ op: "delete", rowId: row.id });
  });

  it("does not touch other rows' entries", async () => {
    const a = await saveExpense(db, "u", input());
    const b = await saveExpense(db, "u", input({ item: "Bread" }));
    await deleteExpense(db, a.id);
    const out = await db.outbox.toArray();
    expect(out.map((e) => [e.rowId, e.op]).sort()).toEqual([[a.id, "delete"], [b.id, "upsert"]].sort());
  });
});

describe("saveReceipt", () => {
  it("saves 3 rows and queues one upsertMany", async () => {
    const rows = await saveReceipt(db, "u", [input({ item: "a" }), input({ item: "b" }), input({ item: "c" })]);
    expect(rows).toHaveLength(3);
    expect(await db.expenses.count()).toBe(3);
    const out = await db.outbox.toArray();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ op: "upsertMany", rowId: null });
    expect(out[0].payload).toHaveLength(3);
  });
});

describe("shopping items", () => {
  it("creates, edits (merging) and deletes with collapsing", async () => {
    const row = await saveShoppingItem(db, "u", { item: "Eggs", quantity: 6 });
    expect(row).toMatchObject({ item: "Eggs", quantity: 6, purchased: false, account_id: "u" });
    const edited = await saveShoppingItem(db, "u", { purchased: true }, row.id);
    expect(edited).toMatchObject({ item: "Eggs", quantity: 6, purchased: true });
    const out = await db.outbox.toArray();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ table: "shopping_lists", op: "upsert" });
    await deleteShoppingItem(db, row.id);
    expect(await db.shoppingItems.count()).toBe(0);
    expect((await db.outbox.toArray()).map((e) => e.op)).toEqual(["delete"]);
  });

  it("requires item when creating", async () => {
    await expect(saveShoppingItem(db, "u", { quantity: 1 })).rejects.toThrow();
    expect(await db.outbox.count()).toBe(0);
  });
});

describe("toLocalExpense", () => {
  it("_ts of a late-November offset date falls within November local bounds", () => {
    const row = toLocalExpense({ ...input(), expense_date: "2026-11-30T23:30:00+02:00" } as unknown as Expense);
    expect(row._ts).toBe(Date.parse("2026-11-30T21:30:00Z"));
    // the same bounds fetch/queries use: [start of month, start of next month) in local time
    expect(row._ts).toBeGreaterThanOrEqual(new Date(2026, 10, 1).getTime() - 14 * 3600_000);
    expect(row._ts).toBeLessThan(new Date(2026, 11, 1).getTime() + 14 * 3600_000);
  });
});

describe("per-user databases", () => {
  it("are separate", async () => {
    const dbA = openUserDb("A-iso");
    const dbB = openUserDb("B-iso");
    const row = await saveExpense(dbA, "A", input());
    expect(await dbB.expenses.get(row.id)).toBeUndefined();
    expect(await dbB.outbox.count()).toBe(0);
  });
});

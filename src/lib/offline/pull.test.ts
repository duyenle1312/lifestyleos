import { beforeEach, describe, expect, it } from "vitest";
import { type LocalDb, openUserDb } from "./db";
import { FakeRemote } from "./__tests__/fakeRemote";
import { saveExpense, saveShoppingItem } from "./mutations";
import { hasPulled, isAwaitingFirstPull, overlapCursor, pullAll } from "./pull";

const exp = (id: string, over = {}) => ({
  id, amount: 5, currency: "EUR", expense_date: "2026-11-10T12:00:00.000Z", item: "Milk", deleted_at: null, account_id: "u",
  updated_at: "2026-11-10T00:00:00.000Z", ...over,
});

let db: LocalDb;
let remote: FakeRemote;
let n = 0;
beforeEach(() => { db = openUserDb(`pl${++n}-${Math.random()}`); remote = new FakeRemote(); });

describe("pullAll", () => {
  it("fills an empty db from all tables", async () => {
    remote.seed("expenses", exp("e1"));
    remote.seed("shopping_lists", { id: "s1", account_id: "u", updated_at: "2026-11-10T00:00:00.000Z", deleted_at: null });
    remote.seed("inventory_items", { id: "i1", account_id: "u", updated_at: "2026-11-10T00:00:00.000Z", deleted_at: null });
    await pullAll(db, remote, "u");
    expect((await db.expenses.get("e1"))?._ts).toBe(Date.parse("2026-11-10T12:00:00.000Z"));
    expect(await db.shoppingItems.count()).toBe(1);
    expect(await db.inventoryItems.count()).toBe(1);
  });

  it("advances the cursor and uses it next time", async () => {
    remote.seed("expenses", exp("e1", { updated_at: "2026-11-10T00:00:00.000Z" }));
    remote.seed("expenses", exp("e2", { updated_at: "2026-11-12T00:00:00.000Z" }));
    await pullAll(db, remote, "u");
    expect((await db.meta.get("cursor:expenses"))?.value).toBe("2026-11-12T00:00:00.000Z");
    remote.sinceCursors = [];
    await pullAll(db, remote, "u");
    // queried from one minute before the stored cursor; the stored cursor stays the true max
    expect(remote.sinceCursors[0]).toBe("2026-11-11T23:59:00.000Z");
    expect((await db.meta.get("cursor:expenses"))?.value).toBe("2026-11-12T00:00:00.000Z");
  });

  it("overlapCursor subtracts one minute and keeps null", () => {
    expect(overlapCursor(null)).toBeNull();
    expect(overlapCursor("2026-11-12T00:00:30.000Z")).toBe("2026-11-11T23:59:30.000Z");
    expect(overlapCursor("2026-11-12T00:00:00.123456+00:00")).toBe("2026-11-11T23:59:00.123Z");
  });

  it("re-applying overlapping rows does not move the cursor back", async () => {
    remote.seed("expenses", exp("e1", { updated_at: "2026-11-12T00:00:00.000Z" }));
    remote.seed("expenses", exp("e0", { updated_at: "2026-11-11T23:59:30.000Z" }));
    await pullAll(db, remote, "u");
    await pullAll(db, remote, "u");
    expect((await db.meta.get("cursor:expenses"))?.value).toBe("2026-11-12T00:00:00.000Z");
    expect(await db.expenses.count()).toBe(2);
  });

  it("writes pulled markers even when the server tables are empty", async () => {
    expect(await hasPulled(db, "expenses")).toBe(false);
    expect(await hasPulled(db, "refs")).toBe(false);
    await pullAll(db, remote, "u");
    for (const scope of ["expenses", "shopping_lists", "inventory_items", "refs"] as const) {
      expect(await hasPulled(db, scope)).toBe(true);
    }
    expect(await db.meta.get("cursor:expenses")).toBeUndefined();
  });

  it("is awaiting the first pull only while syncing and before the marker exists", async () => {
    expect(isAwaitingFirstPull(true, await hasPulled(db, "shopping_lists"))).toBe(true);
    await pullAll(db, remote, "u");
    expect(isAwaitingFirstPull(true, await hasPulled(db, "shopping_lists"))).toBe(false);
    expect(isAwaitingFirstPull(false, false)).toBe(false);
    expect(isAwaitingFirstPull(true, undefined)).toBe(false);
  });

  it("does not write a marker when stopped mid-pull", async () => {
    await pullAll(db, remote, "u", () => true);
    expect(await hasPulled(db, "expenses")).toBe(false);
  });

  it("removes a row soft-deleted remotely", async () => {
    remote.seed("expenses", exp("e1"));
    await pullAll(db, remote, "u");
    remote.seed("expenses", exp("e1", { deleted_at: "2026-11-13T00:00:00.000Z", updated_at: "2026-11-13T00:00:00.000Z" }));
    await pullAll(db, remote, "u");
    expect(await db.expenses.get("e1")).toBeUndefined();
  });

  it("local wins until sent: skips rows with a queued entry", async () => {
    const local = await saveExpense(db, "u", {
      amount: 9, currency: "EUR", expense_date: "2026-11-10T12:00:00.000Z", category_id: null, description: null,
      location: null, unit: null, unit_price: null, expire_date: null, payment_method_id: null, item: "Local",
    });
    const s = await saveShoppingItem(db, "u", { item: "Bread" });
    remote.seed("expenses", exp(local.id, { item: "Server", updated_at: "2026-11-12T00:00:00.000Z" }));
    remote.seed("shopping_lists", { id: s.id, account_id: "u", item: "Server", updated_at: "2026-11-12T00:00:00.000Z", deleted_at: null });
    await pullAll(db, remote, "u");
    expect((await db.expenses.get(local.id))?.item).toBe("Local");
    expect((await db.shoppingItems.get(s.id))?.item).toBe("Bread");
  });

  it("replaces categories and payment methods fully", async () => {
    await db.categories.put({ id: "old" } as never);
    remote.ref.categories = [{ id: "c1", account_id: "u" }, { id: "c2", account_id: "u" }];
    remote.ref.payment_methods = [{ id: "p1", account_id: "u" }];
    await pullAll(db, remote, "u");
    expect((await db.categories.toArray()).map((c) => c.id).sort()).toEqual(["c1", "c2"]);
    expect(await db.paymentMethods.count()).toBe(1);
  });

  it("keeps local reference rows when the server returns none", async () => {
    await db.categories.put({ id: "keep" } as never);
    await pullAll(db, remote, "u");
    expect(await db.categories.count()).toBe(1);
  });
});

describe("pullAll account filter", () => {
  it("drops rows from another account", async () => {
    remote.seed("expenses", exp("mine", { account_id: "u" }));
    remote.seed("expenses", exp("theirs", { account_id: "other" }));
    remote.ref.categories = [{ id: "c1", account_id: "other" }, { id: "c2", account_id: "u" }];
    await pullAll(db, remote, "u");
    expect((await db.expenses.toArray()).map((e) => e.id)).toEqual(["mine"]);
    expect((await db.categories.toArray()).map((c) => c.id)).toEqual(["c2"]);
  });
});

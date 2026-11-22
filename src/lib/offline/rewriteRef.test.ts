import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { type LocalDb, type OutboxEntry, openUserDb } from "./db";
import { rewriteRefInOutbox } from "./rewriteRef";

const entry = (over: Partial<OutboxEntry>): OutboxEntry => ({
  table: "expenses", op: "upsert", rowId: "e1", payload: {}, createdAt: 1, attempts: 2, status: "failed", error: "x", ...over,
});

let db: LocalDb;
beforeEach(() => {
  db = openUserDb(`rw-${Math.random()}`);
});

describe("rewriteRefInOutbox", () => {
  it("rewrites upsert and upsertMany payloads, leaving other entries and status alone", async () => {
    await db.outbox.bulkAdd([
      entry({ payload: { id: "e1", category_id: "old" } }),
      entry({ op: "upsertMany", rowId: null, payload: [{ id: "e2", category_id: "old" }, { id: "e3", category_id: "keep" }] }),
      entry({ rowId: "e4", payload: { id: "e4", category_id: "keep" } }),
      entry({ table: "shopping_lists", rowId: "s1", payload: { id: "s1", category_id: "old" } }),
    ]);
    await rewriteRefInOutbox(db, "category_id", "old", "new");
    const all = await db.outbox.toArray();
    expect(all[0].payload).toEqual({ id: "e1", category_id: "new" });
    expect(all[0].attempts).toBe(2);
    expect(all[0].status).toBe("failed");
    expect(all[1].payload).toEqual([{ id: "e2", category_id: "new" }, { id: "e3", category_id: "keep" }]);
    expect(all[2].payload).toEqual({ id: "e4", category_id: "keep" });
    expect(all[3].payload).toEqual({ id: "s1", category_id: "old" });
  });

  it("clears the field when there is no target", async () => {
    await db.outbox.add(entry({ payload: { id: "e1", payment_method_id: "old" } }));
    await rewriteRefInOutbox(db, "payment_method_id", "old", null);
    expect((await db.outbox.toArray())[0].payload).toEqual({ id: "e1", payment_method_id: null });
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { type LocalDb, openUserDb } from "./db";
import { deleteExpense, saveExpense, saveReceipt, saveShoppingItem } from "./mutations";
import { pushOutbox } from "./push";
import { type Remote, RemoteError, type RemoteTable, isRetryable } from "./remote";
import type { ExpenseInput } from "../services";

const input = (over: Partial<ExpenseInput> = {}): ExpenseInput => ({
  amount: 5, currency: "EUR", expense_date: "2026-11-10T12:00:00.000Z", category_id: null, description: null,
  location: null, unit: null, unit_price: null, expire_date: null, payment_method_id: null, item: "Milk", ...over,
});

type Row = Record<string, unknown>;

class FakeRemote implements Remote {
  rows: Record<string, Map<string, Row>> = { expenses: new Map(), shopping_lists: new Map() };
  calls: string[] = [];
  upsertPayloads: Row[][] = [];
  /** Errors to throw on upsert, in order; `after` applies the write first (lost response). */
  upsertErrors: { error: unknown; after?: boolean }[] = [];
  onUpsert?: () => Promise<void>;

  async upsert(table: RemoteTable, rows: object[]) {
    this.calls.push(`upsert:${table}`);
    this.upsertPayloads.push(rows as Row[]);
    const err = this.upsertErrors.shift();
    if (err && !err.after) throw err.error;
    const stored: Row[] = (rows as Row[]).map((r) => ({ ...r, updated_at: "2026-11-11T00:00:00.000Z" }));
    for (const r of stored) this.rows[table].set(r.id as string, r);
    if (err) throw err.error;
    await this.onUpsert?.();
    return stored;
  }
  async softDelete(table: RemoteTable, id: string) {
    this.calls.push(`delete:${table}:${id}`);
    const r = this.rows[table].get(id);
    if (r) r.deleted_at = "2026-11-11T00:00:00.000Z";
  }
  async fetchRow(table: RemoteTable, id: string) { return this.rows[table].get(id) ?? null; }
  async fetchChangedSince() { return []; }
  async fetchAll() { return []; }
}

let db: LocalDb;
let remote: FakeRemote;
let n = 0;
beforeEach(() => { db = openUserDb(`p${++n}-${Math.random()}`); remote = new FakeRemote(); });

describe("isRetryable", () => {
  it("classifies errors", () => {
    expect(isRetryable(new TypeError("Failed to fetch"))).toBe(true);
    expect(isRetryable(new RemoteError("offline"))).toBe(true);
    expect(isRetryable(new RemoteError("boom", { status: 503 }))).toBe(true);
    expect(isRetryable(new RemoteError("rls", { code: "42501", status: 403 }))).toBe(false);
    expect(isRetryable(new RemoteError("bad", { status: 400 }))).toBe(false);
  });
});

describe("pushOutbox", () => {
  it("sends entries oldest first and clears the outbox", async () => {
    const a = await saveExpense(db, "u", input({ item: "A" }));
    await saveShoppingItem(db, "u", { item: "B" });
    await deleteExpense(db, a.id);
    const res = await pushOutbox(db, remote);
    expect(res).toEqual({ sent: 2, failed: 0, notices: [] });
    expect(remote.calls[0]).toBe("upsert:shopping_lists");
    expect(await db.outbox.count()).toBe(0);
  });

  it("sends payload without updated_at and with deleted_at null; stores the returned row locally", async () => {
    const row = await saveExpense(db, "u", input());
    await pushOutbox(db, remote);
    expect(remote.upsertPayloads[0][0]).not.toHaveProperty("updated_at");
    expect(remote.upsertPayloads[0][0]).not.toHaveProperty("_ts");
    expect(remote.upsertPayloads[0][0]).toMatchObject({ id: row.id, deleted_at: null });
    expect((await db.expenses.get(row.id))?.updated_at).toBe("2026-11-11T00:00:00.000Z");
  });

  it("retry after lost response sends the same id and the server holds one row", async () => {
    const row = await saveExpense(db, "u", input());
    remote.upsertErrors.push({ error: new TypeError("Failed to fetch"), after: true });
    const first = await pushOutbox(db, remote);
    expect(first.sent).toBe(0);
    expect(await db.outbox.count()).toBe(1);
    const second = await pushOutbox(db, remote);
    expect(second.sent).toBe(1);
    expect(remote.upsertPayloads.map((p) => p[0].id)).toEqual([row.id, row.id]);
    expect(remote.rows.expenses.size).toBe(1);
    expect(await db.outbox.count()).toBe(0);
  });

  it("a network error stops the push and keeps the entry", async () => {
    await saveExpense(db, "u", input({ item: "A" }));
    await saveShoppingItem(db, "u", { item: "B" });
    remote.upsertErrors.push({ error: new TypeError("Failed to fetch") });
    const res = await pushOutbox(db, remote);
    expect(res).toMatchObject({ sent: 0, failed: 0 });
    expect(remote.calls.filter((c) => c.startsWith("upsert"))).toHaveLength(1);
    const out = await db.outbox.toArray();
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ status: "pending" });
  });

  it("23503 nulls category and payment method refs and retries once", async () => {
    await saveExpense(db, "u", input({ category_id: "c1", payment_method_id: "p1" }));
    remote.upsertErrors.push({ error: new RemoteError("fk", { code: "23503", status: 409 }) });
    const res = await pushOutbox(db, remote);
    expect(res.sent).toBe(1);
    expect(remote.upsertPayloads).toHaveLength(2);
    expect(remote.upsertPayloads[1][0]).toMatchObject({ category_id: null, payment_method_id: null });
  });

  it("23503 twice marks the entry failed", async () => {
    await saveExpense(db, "u", input({ category_id: "c1" }));
    const e = new RemoteError("fk", { code: "23503", status: 409 });
    remote.upsertErrors.push({ error: e }, { error: e });
    const res = await pushOutbox(db, remote);
    expect(res).toMatchObject({ sent: 0, failed: 1 });
    expect((await db.outbox.toArray())[0]).toMatchObject({ status: "failed", error: "fk" });
  });

  it("a 42501 failure is marked failed and the next unrelated entry still sends", async () => {
    await saveExpense(db, "u", input({ item: "A" }));
    await saveShoppingItem(db, "u", { item: "B" });
    remote.upsertErrors.push({ error: new RemoteError("rls", { code: "42501", status: 403 }) });
    const res = await pushOutbox(db, remote);
    expect(res).toMatchObject({ sent: 1, failed: 1 });
    const out = await db.outbox.toArray();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ table: "expenses", status: "failed", error: "rls", attempts: 1 });
  });

  it("does not send a later entry for the same row behind a failed one", async () => {
    const row = await saveExpense(db, "u", input());
    await db.outbox.toCollection().modify({ attempts: 1 });
    await saveExpense(db, "u", input({ amount: 8 }), row.id);
    remote.upsertErrors.push({ error: new RemoteError("rls", { code: "42501", status: 403 }) });
    const res = await pushOutbox(db, remote);
    expect(res).toMatchObject({ sent: 0, failed: 1 });
    expect(remote.calls).toHaveLength(1);
    expect(await db.outbox.count()).toBe(2);
  });

  it("restores a row deleted on the server, keeping metadata and recording the restore", async () => {
    const row = await saveExpense(db, "u", input());
    remote.rows.expenses.set(row.id, {
      id: row.id, deleted_at: "2026-11-05T00:00:00.000Z", metadata: { keep: "me", restored_after_delete: [{ deleted_at: "x", restored_at: "y" }] },
    });
    const res = await pushOutbox(db, remote);
    expect(res.notices).toEqual(["1 item restored — it had been deleted on another device"]);
    const sent = remote.upsertPayloads[0][0] as { deleted_at: unknown; metadata: { keep: string; restored_after_delete: Row[] } };
    expect(sent.deleted_at).toBeNull();
    expect(sent.metadata.keep).toBe("me");
    expect(sent.metadata.restored_after_delete).toHaveLength(2);
    expect(sent.metadata.restored_after_delete[1]).toMatchObject({ deleted_at: "2026-11-05T00:00:00.000Z" });
    expect(typeof sent.metadata.restored_after_delete[1].restored_at).toBe("string");
  });

  it("upsertMany makes exactly one remote upsert call", async () => {
    await saveReceipt(db, "u", [input({ item: "A" }), input({ item: "B" }), input({ item: "C" })]);
    const res = await pushOutbox(db, remote);
    expect(res.sent).toBe(1);
    expect(remote.calls).toEqual(["upsert:expenses"]);
    expect(remote.upsertPayloads[0]).toHaveLength(3);
    expect(remote.rows.expenses.size).toBe(3);
  });

  it("an edit made while an upsert is in flight is not lost", async () => {
    const row = await saveExpense(db, "u", input({ amount: 5 }));
    remote.onUpsert = async () => { await saveExpense(db, "u", input({ amount: 99 }), row.id); };
    const res = await pushOutbox(db, remote);
    expect(res.sent).toBe(1);
    const out = await db.outbox.toArray();
    expect(out).toHaveLength(1);
    expect(out[0].payload).toMatchObject({ id: row.id, amount: 99 });
    expect((await db.expenses.get(row.id))?.amount).toBe(99);
    remote.onUpsert = undefined;
    await pushOutbox(db, remote);
    expect(remote.rows.expenses.get(row.id)?.amount).toBe(99);
    expect(await db.outbox.count()).toBe(0);
  });
});

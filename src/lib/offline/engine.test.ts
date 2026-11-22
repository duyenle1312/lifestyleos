import { beforeEach, describe, expect, it } from "vitest";
import { type LocalDb, openUserDb } from "./db";
import { SyncEngine } from "./engine";
import { FakeRemote } from "./__tests__/fakeRemote";
import { saveExpense } from "./mutations";
import { RemoteError } from "./remote";

const input = {
  amount: 5, currency: "EUR", expense_date: "2026-11-10T12:00:00.000Z", category_id: null, description: null,
  location: null, unit: null, unit_price: null, expire_date: null, payment_method_id: null, item: "Milk",
};

let db: LocalDb;
let remote: FakeRemote;
let online: boolean;
let engine: SyncEngine;
let n = 0;
beforeEach(() => {
  db = openUserDb(`en${++n}-${Math.random()}`);
  remote = new FakeRemote();
  online = true;
  engine = new SyncEngine(db, remote, "u", () => online);
});

describe("SyncEngine", () => {
  it("pushes before pulling", async () => {
    await saveExpense(db, "u", input);
    await engine.syncNow();
    expect(remote.calls[0]).toBe("upsert:expenses");
    expect(remote.calls.findIndex((c) => c.startsWith("pull:"))).toBeGreaterThan(0);
  });

  it("concurrent calls share one run", async () => {
    await Promise.all([engine.syncNow(), engine.syncNow()]);
    // the in-progress run plus exactly one follow-up
    expect(remote.calls.filter((c) => c === "pull:expenses").length).toBe(2);
    const solo = new FakeRemote();
    const e2 = new SyncEngine(db, solo, "u", () => true);
    await Promise.all([e2.syncNow(), e2.syncNow(), e2.syncNow()]);
    expect(solo.calls.filter((c) => c === "pull:expenses").length).toBe(2);
  });

  it("a write made mid-sync is pushed by the follow-up run", async () => {
    let wrote = false;
    remote.onFetch = async () => {
      if (wrote) return;
      wrote = true;
      await saveExpense(db, "u", input);
      void engine.syncNow();
    };
    await engine.syncNow();
    expect(remote.calls).toContain("upsert:expenses");
    expect(await db.outbox.count()).toBe(0);
  });

  it("does nothing offline but reports pending", async () => {
    online = false;
    await saveExpense(db, "u", input);
    await engine.syncNow();
    expect(remote.calls).toEqual([]);
    expect(engine.getStatus()).toMatchObject({ online: false, pending: 1, syncing: false });
  });

  it("retry resets a failed entry and syncs; discard drops it and restores server state", async () => {
    remote.rejectUpsert = new RemoteError("bad", { status: 400 });
    const row = await saveExpense(db, "u", input);
    await engine.syncNow();
    const [failed] = engine.getStatus().failed;
    expect(failed.error).toContain("bad");
    expect(engine.getStatus().pending).toBe(0);

    remote.rejectUpsert = null;
    await engine.retry(failed.seq!);
    expect(await db.outbox.count()).toBe(0);
    expect(remote.rows.expenses.has(row.id)).toBe(true);

    remote.rejectUpsert = new RemoteError("bad", { status: 400 });
    const created = await saveExpense(db, "u", { ...input, item: "Doomed" });
    await engine.syncNow();
    const [f2] = engine.getStatus().failed;
    remote.rejectUpsert = null;
    await engine.discard(f2.seq!);
    expect(await db.outbox.count()).toBe(0);
    expect(await db.expenses.get(created.id)).toBeUndefined();
    expect(engine.getStatus().failed).toEqual([]);
  });

  async function failedEntry() {
    remote.rejectUpsert = new RemoteError("bad", { status: 400 });
    const row = await saveExpense(db, "u", input);
    await engine.syncNow();
    remote.rejectUpsert = null;
    return { row, entry: engine.getStatus().failed[0] };
  }

  it("discard restores the local row to the server version", async () => {
    const { row, entry } = await failedEntry();
    remote.seed("expenses", { ...row, item: "Server", deleted_at: null, updated_at: "2026-11-01T00:00:00.000Z" });
    await engine.discard(entry.seq!);
    expect((await db.expenses.get(row.id))?.item).toBe("Server");
    expect(await db.outbox.count()).toBe(0);
  });

  it("discard with a retryable fetch error keeps the entry and local row", async () => {
    const { row, entry } = await failedEntry();
    remote.fetchRow = async () => { throw new TypeError("Failed to fetch"); };
    await expect(engine.discard(entry.seq!)).rejects.toThrow(/try again/);
    expect(await db.outbox.count()).toBe(1);
    expect(await db.expenses.get(row.id)).toBeDefined();
  });

  it("discard of an upsertMany entry reconciles each row", async () => {
    await db.expenses.bulkPut([
      { ...input, id: "r1", _ts: 0 }, { ...input, id: "r2", _ts: 0 },
    ] as never);
    const seq = await db.outbox.add({
      table: "expenses", op: "upsertMany", rowId: null, payload: [{ id: "r1" }, { id: "r2" }],
      createdAt: 0, attempts: 1, status: "failed", error: "x",
    });
    remote.seed("expenses", { ...input, id: "r1", item: "Server", deleted_at: null, updated_at: "2026-11-01T00:00:00.000Z" });
    await engine.discard(seq as number);
    expect((await db.expenses.get("r1"))?.item).toBe("Server");
    expect(await db.expenses.get("r2")).toBeUndefined();
  });

  it("dedupes identical notices", async () => {
    remote.fetchChangedSince = async () => { throw new RemoteError("rls", { status: 403 }); };
    await engine.syncNow();
    await engine.syncNow();
    expect(engine.getStatus().notices).toHaveLength(1);
  });

  it("surfaces non-retryable pull errors as notices and keeps quiet on retryable ones", async () => {
    remote.fetchChangedSince = async () => { throw new TypeError("Failed to fetch"); };
    await engine.syncNow();
    expect(engine.getStatus().notices).toEqual([]);
    remote.fetchChangedSince = async () => { throw new RemoteError("rls", { status: 403 }); };
    await engine.syncNow();
    expect(engine.getStatus().notices).toHaveLength(1);
    engine.dismissNotice(0);
    expect(engine.getStatus().notices).toEqual([]);
  });

  it("notifies subscribers", async () => {
    const seen: boolean[] = [];
    const off = engine.subscribe((s) => seen.push(s.syncing));
    await engine.syncNow();
    off();
    expect(seen).toContain(true);
    expect(seen.at(-1)).toBe(false);
  });
});

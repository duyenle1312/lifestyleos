import { beforeEach, describe, expect, it } from "vitest";
import { type LocalDb, openUserDb } from "./db";
import { SyncEngine } from "./engine";
import { FakeRemote } from "./fakeRemote";
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
    const a = engine.syncNow();
    const b = engine.syncNow();
    await Promise.all([a, b]);
    // one run plus at most one follow-up run
    expect(remote.calls.filter((c) => c === "pull:expenses").length).toBeLessThanOrEqual(2);
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

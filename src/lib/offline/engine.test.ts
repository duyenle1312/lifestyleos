import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type LocalDb, openUserDb } from "./db";
import { RETRY_BASE_MS, RETRY_MAX_MS, SyncEngine } from "./engine";
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

describe("SyncEngine shutdown and identity", () => {
  it("stop() awaits the running sync and nothing is written after it", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    remote.seed("expenses", { id: "e1", updated_at: "2026-11-10T00:00:00.000Z", deleted_at: null, amount: 1, currency: "EUR", expense_date: "2026-11-10T12:00:00.000Z", item: "x" });
    remote.onFetch = () => gate;
    const run = engine.syncNow();
    await new Promise((r) => setTimeout(r, 10));
    let stopped = false;
    const stopping = engine.stop().then(() => (stopped = true));
    await new Promise((r) => setTimeout(r, 10));
    expect(stopped).toBe(false);
    release();
    await stopping;
    await run;
    expect(stopped).toBe(true);
    expect(await db.expenses.count()).toBe(0);
  });

  it("skips push and pull when the session user is someone else", async () => {
    await saveExpense(db, "u", input);
    const guarded = new SyncEngine(db, remote, "u", () => true, async () => "other");
    await guarded.syncNow();
    expect(remote.calls).toEqual([]);
    expect(await db.outbox.count()).toBe(1);
  });

  it("runs when the session user matches", async () => {
    const ok = new SyncEngine(db, remote, "u", () => true, async () => "u");
    await ok.syncNow();
    expect(remote.calls.length).toBeGreaterThan(0);
  });

  it("treats DatabaseClosedError as a quiet stop", async () => {
    remote.onFetch = async () => {
      throw Object.assign(new Error("Database has been closed"), { name: "DatabaseClosedError" });
    };
    await engine.syncNow();
    expect(engine.getStatus().notices).toEqual([]);
  });

  it("a new engine on a fresh db instance for the same user syncs after the old one was stopped (StrictMode/Fast Refresh)", async () => {
    const name = `lc-${Math.random()}`;
    const first = openUserDb(name);
    const e1 = new SyncEngine(first, remote, "u", () => true);
    e1.start();
    await e1.stop();
    first.close({ disableAutoOpen: false });
    remote.seed("expenses", { id: "e1", account_id: "u", updated_at: "2026-11-10T00:00:00.000Z", deleted_at: null, amount: 1, currency: "EUR", expense_date: "2026-11-10T12:00:00.000Z", item: "x" });
    const second = openUserDb(name);
    const e2 = new SyncEngine(second, remote, "u", () => true);
    e2.start();
    await e2.syncNow();
    expect(await second.expenses.count()).toBe(1);
    await e2.stop();
  });

  it("a guard that flips mid-push halts before the next entry", async () => {
    await saveExpense(db, "u", input);
    await saveExpense(db, "u", { ...input, item: "Eggs" });
    let calls = 0;
    const g = new SyncEngine(db, remote, "u", () => true, async () => (++calls <= 2 ? "u" : "other"));
    await g.syncNow();
    expect(remote.calls.filter((c) => c.startsWith("upsert")).length).toBe(1);
    // the sent entry was not applied (halted first) and nothing was marked failed; both stay queued
    expect(await db.outbox.count()).toBe(2);
    expect((await db.outbox.toArray()).every((e) => e.status === "pending")).toBe(true);
  });
});

describe("SyncEngine automatic retry", () => {
  // Only timers are faked, so IndexedDB (fake-indexeddb) keeps running on real microtasks/immediates.
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
  afterEach(() => vi.useRealTimers());

  const upserts = () => remote.calls.filter((c) => c.startsWith("upsert")).length;
  /** Fires the pending retry timer and waits for the run it starts. */
  async function fireRetry(ms: number) {
    await vi.advanceTimersByTimeAsync(ms);
    await vi.waitFor(async () => expect(engine.getStatus().syncing).toBe(false));
  }

  it("retries a retryable push error on its own and stops once nothing is pending", async () => {
    let fail = true;
    const upsert = remote.upsert.bind(remote);
    remote.upsert = async (table, rows) => {
      if (fail) {
        remote.calls.push(`upsert:${table}`);
        throw new TypeError("Failed to fetch");
      }
      return upsert(table, rows);
    };
    await saveExpense(db, "u", input);
    await engine.syncNow();
    expect(engine.getStatus().pending).toBe(1);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(RETRY_BASE_MS - 1);
    expect(upserts()).toBe(1);
    fail = false;
    await fireRetry(1);
    await vi.waitFor(async () => expect(await db.outbox.count()).toBe(0));
    expect(upserts()).toBe(2);
    expect(engine.getStatus().pending).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("backs off 15s, 30s, 60s, 60s", async () => {
    remote.rejectUpsert = new TypeError("Failed to fetch");
    await saveExpense(db, "u", input);
    await engine.syncNow();
    expect(upserts()).toBe(1);
    for (const [i, delay] of [RETRY_BASE_MS, 2 * RETRY_BASE_MS, RETRY_MAX_MS, RETRY_MAX_MS].entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(upserts()).toBe(i + 1);
      await fireRetry(1);
      expect(upserts()).toBe(i + 2);
    }
    expect(vi.getTimerCount()).toBe(1);
  });

  it("a new run clears the pending timer (only one timer at a time)", async () => {
    remote.rejectUpsert = new TypeError("Failed to fetch");
    await saveExpense(db, "u", input);
    await engine.syncNow();
    await engine.syncNow();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("does not schedule a retry offline or when only failed entries remain", async () => {
    online = false;
    await saveExpense(db, "u", input);
    await engine.syncNow();
    expect(vi.getTimerCount()).toBe(0);
    online = true;
    remote.rejectUpsert = new RemoteError("bad", { status: 400 });
    await engine.syncNow();
    expect(engine.getStatus()).toMatchObject({ pending: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stop() clears the retry timer", async () => {
    remote.rejectUpsert = new TypeError("Failed to fetch");
    await saveExpense(db, "u", input);
    await engine.syncNow();
    expect(vi.getTimerCount()).toBe(1);
    await engine.stop();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(RETRY_MAX_MS);
    expect(upserts()).toBe(1);
  });
});

describe("SyncEngine cross-tab lock", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("runs each sync inside navigator.locks under a per-user name", async () => {
    const names: string[] = [];
    let held = false;
    let overlapped = false;
    const locks = {
      request: async (name: string, cb: () => Promise<void>) => {
        names.push(name);
        if (held) overlapped = true;
        held = true;
        try {
          return await cb();
        } finally {
          held = false;
        }
      },
    };
    vi.stubGlobal("navigator", { onLine: true, locks });
    await saveExpense(db, "u", input);
    await Promise.all([engine.syncNow(), engine.syncNow()]);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names)).toEqual(new Set(["lifestyleos-sync-u"]));
    expect(overlapped).toBe(false);
    expect(await db.outbox.count()).toBe(0);
  });
});

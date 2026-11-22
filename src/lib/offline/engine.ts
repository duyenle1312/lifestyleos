// Orchestrates sync: push the outbox, then pull server changes. Single-flight, with status for the UI.
import { type LocalDb, type OutboxEntry } from "./db";
import { applyServerRow, deleteLocal, pullAll, queuedIds } from "./pull";
import { pushOutbox } from "./push";
import { type Remote, isRetryable } from "./remote";

export type SyncStatus = { online: boolean; syncing: boolean; pending: number; failed: OutboxEntry[]; notices: string[] };

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

export class SyncEngine {
  private listeners = new Set<(s: SyncStatus) => void>();
  private status: SyncStatus;
  private running: Promise<void> | null = null;
  private again = false;
  private onOnline = () => void this.syncNow();
  private onOffline = () => this.update({ online: false });
  private onVisible = () => {
    if (document.visibilityState === "visible") void this.syncNow();
  };

  constructor(
    private db: LocalDb,
    private remote: Remote,
    private userId: string,
    private isOnline: () => boolean,
  ) {
    this.status = { online: isOnline(), syncing: false, pending: 0, failed: [], notices: [] };
  }

  start(): void {
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.onOnline);
      window.addEventListener("offline", this.onOffline);
    }
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.onVisible);
    void this.syncNow();
  }

  stop(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.onOnline);
      window.removeEventListener("offline", this.onOffline);
    }
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onVisible);
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  subscribe(fn: (s: SyncStatus) => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  dismissNotice(i: number): void {
    this.update({ notices: this.status.notices.filter((_, j) => j !== i) });
  }

  private addNotice(text: string): void {
    if (!this.status.notices.includes(text)) this.update({ notices: [...this.status.notices, text] });
  }

  private update(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach((fn) => fn(this.status));
  }

  private async refreshOutbox(): Promise<void> {
    const entries = await this.db.outbox.toArray();
    this.update({
      online: this.isOnline(),
      pending: entries.filter((e) => e.status === "pending").length,
      failed: entries.filter((e) => e.status === "failed"),
    });
  }

  syncNow(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.again = false;
          await this.runOnce();
        } while (this.again);
      } finally {
        this.running = null;
        this.update({ syncing: false });
      }
    })();
    return this.running;
  }

  private async runOnce(): Promise<void> {
    try {
      if (!this.isOnline()) {
        await this.refreshOutbox();
        return;
      }
      this.update({ syncing: true });
      try {
        const res = await pushOutbox(this.db, this.remote);
        res.notices.forEach((n) => this.addNotice(n));
        await pullAll(this.db, this.remote, this.userId);
      } catch (e) {
        if (!isRetryable(e)) this.addNotice(`Sync problem: ${messageOf(e)}`);
      }
      await this.refreshOutbox();
    } catch (e) {
      if (!isRetryable(e)) this.addNotice(`Sync problem: ${messageOf(e)}`);
    }
  }

  async retry(seq: number): Promise<void> {
    await this.db.outbox.update(seq, { status: "pending", error: null });
    await this.syncNow();
  }

  /**
   * Drops a queued change and makes the local copy match the server. Server rows are fetched first, so a failed
   * fetch leaves the entry untouched. Throws when offline-ish; non-retryable failures become a notice.
   */
  async discard(seq: number): Promise<void> {
    const entry = await this.db.outbox.get(seq);
    if (!entry) return;
    const ids = [...queuedIds([entry], entry.table)];
    const server = new Map<string, Record<string, unknown> | null>();
    try {
      for (const id of ids) server.set(id, (await this.remote.fetchRow(entry.table, id)) as Record<string, unknown> | null);
    } catch (e) {
      if (isRetryable(e)) throw new Error("Couldn't discard — try again when online");
      this.addNotice(`Couldn't discard: ${messageOf(e)}`);
      return;
    }
    await this.db.transaction("rw", [this.db.outbox, this.db.expenses, this.db.shoppingItems], async () => {
      await this.db.outbox.delete(seq);
      const queued = queuedIds(await this.db.outbox.toArray(), entry.table);
      for (const [id, row] of server) {
        if (queued.has(id)) continue;
        if (!row || row.deleted_at) await deleteLocal(this.db, entry.table, id);
        else await applyServerRow(this.db, entry.table, row);
      }
    });
    await this.syncNow();
    await this.refreshOutbox();
  }
}

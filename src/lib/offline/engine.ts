// Orchestrates sync: push the outbox, then pull server changes. Single-flight, with status for the UI.
import { type LocalDb, type OutboxEntry } from "./db";
import { applyServerRow, pullAll, queuedIds } from "./pull";
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
    if (typeof window !== "undefined") window.addEventListener("online", this.onOnline);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this.onVisible);
    void this.syncNow();
  }

  stop(): void {
    if (typeof window !== "undefined") window.removeEventListener("online", this.onOnline);
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
    if (!this.isOnline()) {
      await this.refreshOutbox();
      return;
    }
    this.update({ syncing: true });
    try {
      const res = await pushOutbox(this.db, this.remote);
      if (res.notices.length) this.update({ notices: [...this.status.notices, ...res.notices] });
      await pullAll(this.db, this.remote, this.userId);
    } catch (e) {
      if (!isRetryable(e)) this.update({ notices: [...this.status.notices, `Sync problem: ${messageOf(e)}`] });
    }
    await this.refreshOutbox();
  }

  async retry(seq: number): Promise<void> {
    await this.db.outbox.update(seq, { status: "pending", error: null });
    await this.syncNow();
  }

  async discard(seq: number): Promise<void> {
    const entry = await this.db.outbox.get(seq);
    if (!entry) return;
    await this.db.outbox.delete(seq);
    const ids = [...queuedIds([entry], entry.table)];
    try {
      // Make the local copy match the server: the cursor may already be past a row the failed change touched.
      for (const id of ids) {
        const server = (await this.remote.fetchRow(entry.table, id)) as Record<string, unknown> | null;
        const stillQueued = queuedIds(await this.db.outbox.toArray(), entry.table).has(id);
        if (stillQueued) continue;
        await applyServerRow(this.db, entry.table, server ?? { id, deleted_at: "gone" });
      }
    } catch (e) {
      if (!isRetryable(e)) this.update({ notices: [...this.status.notices, `Sync problem: ${messageOf(e)}`] });
    }
    await this.syncNow();
    await this.refreshOutbox();
  }
}

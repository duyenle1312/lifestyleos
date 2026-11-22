// Orchestrates sync: push the outbox, then pull server changes. Single-flight, with status for the UI.
import { type LocalDb, type OutboxEntry } from "./db";
import { applyServerRow, deleteLocal, pullAll, queuedIds } from "./pull";
import { pushOutbox } from "./push";
import { type Remote, isRetryable } from "./remote";

export type SyncStatus = { online: boolean; syncing: boolean; pending: number; failed: OutboxEntry[]; notices: string[] };

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Automatic retry while changes are still waiting online: 15s, doubling up to 60s. */
export const RETRY_BASE_MS = 15_000;
export const RETRY_MAX_MS = 60_000;

export class SyncEngine {
  private listeners = new Set<(s: SyncStatus) => void>();
  private status: SyncStatus;
  private running: Promise<void> | null = null;
  private again = false;
  private stopped = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = RETRY_BASE_MS;
  private isStopped = () => this.stopped;
  /** Checked before each outbox entry: stopped, or the session now belongs to someone else. */
  private shouldHalt = async () => this.stopped || !(await this.isCurrentUser());
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
    /** Identity guard: the signed-in user id right now. A run is skipped when it is not this engine's user. */
    private currentUserId?: () => Promise<string | null>,
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

  /** Stops listening and resolves once any running sync has finished. After this the engine does no more work. */
  async stop(): Promise<void> {
    this.stopped = true;
    this.clearRetry();
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.onOnline);
      window.removeEventListener("offline", this.onOffline);
    }
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onVisible);
    await this.running?.catch(() => undefined);
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
    if (this.stopped) return;
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
    if (this.stopped) return Promise.resolve();
    this.clearRetry();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.again = false;
          await this.runLocked();
        } while (this.again && !this.stopped);
      } finally {
        this.running = null;
        this.update({ syncing: false });
        this.scheduleRetry();
      }
    })();
    return this.running;
  }

  private clearRetry(): void {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  /**
   * After a run that leaves changes waiting while online (e.g. a retryable push error), try again on its own:
   * a server hiccup otherwise waits for the next online/visibility/auth event. One timer at a time.
   */
  private scheduleRetry(): void {
    this.clearRetry();
    if (this.stopped || !this.isOnline() || this.status.pending === 0) {
      this.retryDelay = RETRY_BASE_MS;
      return;
    }
    const delay = this.retryDelay;
    this.retryDelay = Math.min(delay * 2, RETRY_MAX_MS);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.syncNow();
    }, delay);
  }

  /** Runs one sync under a per-user Web Lock (when available) so two tabs never push the same outbox at once. */
  private async runLocked(): Promise<void> {
    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    if (!locks) return this.runOnce();
    await locks.request(`lifestyleos-sync-${this.userId}`, async () => {
      await this.runOnce();
    });
  }

  private async isCurrentUser(): Promise<boolean> {
    if (!this.currentUserId) return true;
    return (await this.currentUserId()) === this.userId;
  }

  /** Errors that just mean "this engine was shut down" are not worth a notice. */
  private quiet(e: unknown): boolean {
    return this.stopped || (e as { name?: string } | null)?.name === "DatabaseClosedError";
  }

  private async runOnce(): Promise<void> {
    if (this.stopped) return; // e.g. stopped while waiting for the lock
    try {
      if (!this.isOnline()) {
        await this.refreshOutbox();
        return;
      }
      this.update({ syncing: true });
      try {
        if (!(await this.isCurrentUser()) || this.stopped) {
          await this.refreshOutbox();
          return;
        }
        const res = await pushOutbox(this.db, this.remote, this.shouldHalt);
        if (res.sent > 0) this.retryDelay = RETRY_BASE_MS;
        res.notices.forEach((n) => this.addNotice(n));
        if (!(await this.isCurrentUser()) || this.stopped) {
          await this.refreshOutbox();
          return;
        }
        await pullAll(this.db, this.remote, this.userId, this.isStopped);
      } catch (e) {
        if (!this.quiet(e) && !isRetryable(e)) this.addNotice(`Sync problem: ${messageOf(e)}`);
      }
      if (this.stopped) return;
      await this.refreshOutbox();
    } catch (e) {
      if (!this.quiet(e) && !isRetryable(e)) this.addNotice(`Sync problem: ${messageOf(e)}`);
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

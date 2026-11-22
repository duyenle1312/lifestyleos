// Test double for Remote shared by pull/engine tests.
import { type PullTable, type ReferenceTable, type Remote, type RemoteTable } from "./remote";

type Row = Record<string, unknown>;

export class FakeRemote implements Remote {
  rows: Record<string, Map<string, Row>> = { expenses: new Map(), shopping_lists: new Map(), inventory_items: new Map() };
  ref: Record<string, Row[]> = { categories: [], payment_methods: [] };
  calls: string[] = [];
  sinceCursors: (string | null)[] = [];
  rejectUpsert: unknown = null;
  onFetch?: () => Promise<void>;

  seed(table: PullTable, row: Row) { this.rows[table].set(row.id as string, row); }
  async upsert(table: RemoteTable, rows: object[]) {
    this.calls.push(`upsert:${table}`);
    if (this.rejectUpsert) throw this.rejectUpsert;
    const stored: Row[] = (rows as Row[]).map((r) => ({ ...r, updated_at: "2026-11-11T00:00:00.000Z" }));
    for (const r of stored) this.rows[table].set(r.id as string, r);
    return stored;
  }
  async softDelete(table: RemoteTable, id: string) {
    this.calls.push(`delete:${table}:${id}`);
    const r = this.rows[table].get(id);
    if (r) r.deleted_at = "2026-11-11T00:00:00.000Z";
  }
  async fetchRow(table: RemoteTable, id: string) { return this.rows[table].get(id) ?? null; }
  async fetchChangedSince(table: PullTable, cursor: string | null) {
    this.calls.push(`pull:${table}`);
    this.sinceCursors.push(cursor);
    await this.onFetch?.();
    return [...this.rows[table].values()].filter((r) => cursor === null || (r.updated_at as string) >= cursor);
  }
  async fetchAll(table: ReferenceTable) { return this.ref[table]; }
}

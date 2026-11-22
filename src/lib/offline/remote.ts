// The server side of sync, as an interface so push/pull can be tested against a fake.

export type RemoteTable = "expenses" | "shopping_lists";

export interface Remote {
  /** Upserts rows (by id) and returns the stored rows. */
  upsert(table: RemoteTable, rows: object[]): Promise<object[]>;
  softDelete(table: RemoteTable, id: string): Promise<void>;
  /** Returns the row including soft-deleted ones, or null if it does not exist. */
  fetchRow(table: RemoteTable, id: string): Promise<object | null>;
  fetchChangedSince(table: RemoteTable, cursor: string | null): Promise<object[]>;
  fetchAll(table: "categories" | "payment_methods", accountId: string): Promise<object[]>;
}

export class RemoteError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, opts: { code?: string; status?: number } = {}) {
    super(message);
    this.name = "RemoteError";
    this.code = opts.code;
    this.status = opts.status;
  }
}

/** True for failures worth retrying later: the network is down or the server had a hiccup, not a rejection. */
export function isRetryable(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  if (typeof e !== "object" || e === null) return true;
  const { code, status } = e as { code?: unknown; status?: unknown };
  if (code) return false;
  if (typeof status === "number" && status >= 400 && status < 500) return false;
  return true;
}

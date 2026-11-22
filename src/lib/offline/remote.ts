// The server side of sync, as an interface so push/pull can be tested against a fake.

export type RemoteTable = "expenses" | "shopping_lists";
export type PullTable = RemoteTable | "inventory_items";
export type ReferenceTable = "categories" | "payment_methods";

export interface Remote {
  /** Upserts rows (by id) and returns the stored rows. */
  upsert(table: RemoteTable, rows: object[]): Promise<object[]>;
  softDelete(table: RemoteTable, id: string): Promise<void>;
  /** Returns the row including soft-deleted ones, or null if it does not exist. */
  fetchRow(table: RemoteTable, id: string): Promise<object | null>;
  /** Rows with updated_at >= cursor, including soft-deleted ones. */
  fetchChangedSince(table: PullTable, cursor: string | null): Promise<object[]>;
  fetchAll(table: ReferenceTable, accountId: string): Promise<object[]>;
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

const NETWORK_MESSAGE = /Failed to fetch|NetworkError|Load failed|fetch failed|network/i;
const JWT_CODES = new Set(["PGRST301", "PGRST302", "PGRST303"]);

/**
 * True for failures worth retrying later: network down, server hiccup, or an expired session.
 * Everything else (rejections, constraint/RLS errors, programming bugs) is not retryable.
 */
export function isRetryable(e: unknown): boolean {
  const message = e instanceof Error ? e.message : "";
  if (e instanceof TypeError) return NETWORK_MESSAGE.test(message);
  const { code, status } = (typeof e === "object" && e !== null ? e : {}) as { code?: unknown; status?: unknown };
  if (typeof code === "string" && JWT_CODES.has(code)) return true;
  if (typeof status === "number" && (status === 0 || status === 401 || status === 408 || status === 429 || status >= 500)) return true;
  if (code || typeof status === "number") return false;
  return NETWORK_MESSAGE.test(message);
}

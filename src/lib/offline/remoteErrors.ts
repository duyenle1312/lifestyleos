// Pure mapping from supabase-js results/exceptions to RemoteError (kept free of the supabase client for testing).
import { RemoteError } from "./remote";

export type SupabaseResult = {
  error: { code?: string; message?: string } | null;
  status?: number;
};

/** Network failures (fetch threw, or supabase-js reports status 0 / no code) get status 0 so they are retryable. */
export function toRemoteError(error: { code?: string; message?: string }, status?: number): RemoteError {
  const message = error.message || "Request failed";
  const code = error.code || undefined;
  const isNetwork = status === 0 || (!code && (status === undefined || status === null));
  return new RemoteError(message, { code, status: isNetwork ? 0 : status });
}

/** Throws a RemoteError when the result carries an error. */
export function unwrap(res: SupabaseResult): void {
  if (res.error) throw toRemoteError(res.error, res.status);
}

/** Converts anything thrown (fetch TypeError, etc.) into a RemoteError; RemoteErrors pass through. */
export function normalizeThrown(e: unknown): RemoteError {
  if (e instanceof RemoteError) return e;
  const message = e instanceof Error ? e.message : String(e);
  return new RemoteError(message, { status: 0 });
}

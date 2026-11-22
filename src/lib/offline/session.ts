// Offline session helpers: the remembered user (so an expired login keeps working offline) and per-account local data cleanup.
import Dexie from "dexie";
import type { Session, User } from "@supabase/supabase-js";
import { LocalDb } from "./db";
import { isRetryable } from "./remote";

const KEY = "lifestyleos:lastUser";
const DB_PREFIX = "lifestyleos-";

type RememberedUser = Pick<User, "id" | "email" | "user_metadata">;

export function rememberUser(user: User): void {
  try {
    const { id, email, user_metadata } = user;
    localStorage.setItem(KEY, JSON.stringify({ id, email, user_metadata }));
  } catch {
    // Storage unavailable: offline sessions just won't work.
  }
}

export function forgetRememberedUser(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Id of the remembered user, if any. */
export function rememberedUserId(): string | null {
  return readRemembered()?.id ?? null;
}

/**
 * Whether sign-out must also clear this device's stored session. A global sign-out that fails (offline) leaves the
 * expired session and refresh token in storage, which would silently sign the user back in once online; an offline
 * session has no live session to revoke at all.
 */
export function needsLocalSignOut(error: unknown, isOfflineSession: boolean): boolean {
  return !!error || isOfflineSession;
}

function readRemembered(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as Partial<RememberedUser>;
    if (typeof u?.id !== "string") return null;
    // Only the remembered subset is real; consumers use id, email and user_metadata.
    return { id: u.id, email: u.email, user_metadata: u.user_metadata ?? {}, app_metadata: {}, aud: "authenticated", created_at: "" } as User;
  } catch {
    return null;
  }
}

/** The user to show on load: the session's, or (offline / network failure with no usable session) the remembered one. */
export function resolveInitialUser(session: Session | null, error: unknown, online: boolean): User | null {
  if (session) return session.user;
  if (!online || isRetryable(error)) return readRemembered();
  return null;
}

/** Deletes other accounts' local databases that have nothing queued; keeps the rest and the current user's. */
export async function cleanupOtherUserDbs(currentUserId: string): Promise<void> {
  const current = `${DB_PREFIX}${currentUserId}`;
  const names = (await Dexie.getDatabaseNames()).filter((n) => n.startsWith(DB_PREFIX) && n !== current);
  for (const name of names) {
    try {
      const db = new LocalDb(name);
      let pending: number;
      try {
        pending = await db.outbox.count();
      } finally {
        db.close();
      }
      if (pending === 0) await Dexie.delete(name);
    } catch (e) {
      console.error("Local data cleanup failed for", name, e);
    }
  }
}

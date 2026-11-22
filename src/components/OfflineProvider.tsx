"use client";

// Opens the signed-in user's local database and runs the sync engine for as long as they are signed in.
import { Fragment, createContext, useRef, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { type LocalDb, openUserDb } from "@/lib/offline/db";
import { SyncEngine, type SyncStatus } from "@/lib/offline/engine";
import { supabase } from "@/lib/supabase";
import { supabaseRemote } from "@/lib/offline/supabaseRemote";
import { useUser } from "./AuthProvider";
import { Spinner } from "./ui";

type Sync = Pick<SyncEngine, "syncNow" | "retry" | "discard" | "dismissNotice">;
type Ctx = { db: LocalDb; engine: SyncEngine; userId: string; generation: number };

const OfflineContext = createContext<Ctx | null>(null);

const centeredSpinner = (
  <div className="flex min-h-dvh items-center justify-center">
    <Spinner />
  </div>
);

/**
 * Shows a spinner until the engine for the current user exists (one db + engine pair per effect run, so StrictMode
 * and Fast Refresh re-runs get fresh, running instances). Hooks below are therefore always called with a ready db.
 */
export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const userId = user.id;
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const db = openUserDb(userId);
    // Any failure reads as "unknown user": the engine halts rather than treating an already-sent entry as failed.
    const sessionUserId = async () => {
      try {
        return (await supabase.auth.getSession()).data.session?.user.id ?? null;
      } catch {
        return null;
      }
    };
    const engine = new SyncEngine(db, supabaseRemote, userId, () => navigator.onLine, sessionUserId);
    engine.start();
    // A refreshed or restored login for this user: queued changes held back by an expired token can go now.
    // Deferred: Supabase calls inside this callback (the engine's getSession guard) can deadlock the auth client.
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "TOKEN_REFRESHED" || event === "SIGNED_IN") && session?.user.id === userId) {
        clearTimeout(authTimer);
        authTimer = setTimeout(() => void engine.syncNow(), 0);
      }
    });
    // Publishing the freshly created pair is the point of this effect (it owns external resources).
    setCtx({ db, engine, userId, generation: ++generation.current });
    return () => {
      auth.subscription.unsubscribe();
      clearTimeout(authTimer);
      setCtx((c) => (c?.engine === engine ? null : c));
      // Wait for any in-flight sync to finish before closing the db it is using.
      void (async () => {
        await engine.stop();
        db.close();
      })();
    };
  }, [userId]);

  // Not ready, or the user just changed and the effect has not swapped the pair yet.
  if (!ctx || ctx.userId !== userId) return centeredSpinner;
  // Keyed so children remount (and drop live queries on the old db) whenever the db pair changes.
  return (
    <OfflineContext.Provider value={ctx}>
      <Fragment key={ctx.generation}>{children}</Fragment>
    </OfflineContext.Provider>
  );
}

function useCtx(): Ctx {
  const c = useContext(OfflineContext);
  if (!c) throw new Error("Offline hooks must be used inside <OfflineProvider>");
  return c;
}

export const useLocalDb = (): LocalDb => useCtx().db;

export function useSyncStatus(): SyncStatus {
  const { engine } = useCtx();
  const subscribe = useCallback((cb: () => void) => engine.subscribe(cb), [engine]);
  return useSyncExternalStore(subscribe, () => engine.getStatus(), () => engine.getStatus());
}

export function useSync(): Sync {
  const { engine } = useCtx();
  return useMemo(
    () => ({
      syncNow: () => engine.syncNow(),
      retry: (seq: number) => engine.retry(seq),
      discard: (seq: number) => engine.discard(seq),
      dismissNotice: (i: number) => engine.dismissNotice(i),
    }),
    [engine],
  );
}

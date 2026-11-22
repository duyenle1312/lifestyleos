"use client";

// Opens the signed-in user's local database and runs the sync engine for as long as they are signed in.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { type LocalDb, openUserDb } from "@/lib/offline/db";
import { SyncEngine, type SyncStatus } from "@/lib/offline/engine";
import { supabase } from "@/lib/supabase";
import { supabaseRemote } from "@/lib/offline/supabaseRemote";
import { useUser } from "./AuthProvider";

type Sync = Pick<SyncEngine, "syncNow" | "retry" | "discard" | "dismissNotice">;
type Ctx = { db: LocalDb; engine: SyncEngine };

const OfflineContext = createContext<Ctx | null>(null);

/**
 * Renders nothing until the engine for the current user exists (one db + engine pair per effect run, so StrictMode
 * and Fast Refresh re-runs get fresh, running instances). Hooks below are therefore always called with a ready db.
 */
export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const userId = user.id;
  const [ctx, setCtx] = useState<Ctx | null>(null);

  useEffect(() => {
    const db = openUserDb(userId);
    const sessionUserId = async () => (await supabase.auth.getSession()).data.session?.user.id ?? null;
    const engine = new SyncEngine(db, supabaseRemote, userId, () => navigator.onLine, sessionUserId);
    engine.start();
    // Publishing the freshly created pair is the point of this effect (it owns external resources).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCtx({ db, engine });
    return () => {
      setCtx((c) => (c?.engine === engine ? null : c));
      // Wait for any in-flight sync to finish before closing the db it is using.
      void (async () => {
        await engine.stop();
        db.close();
      })();
    };
  }, [userId]);

  if (!ctx) return null;
  return <OfflineContext.Provider value={ctx}>{children}</OfflineContext.Provider>;
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

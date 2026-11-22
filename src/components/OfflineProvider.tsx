"use client";

// Opens the signed-in user's local database and runs the sync engine for as long as they are signed in.
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { type LocalDb, openUserDb } from "@/lib/offline/db";
import { SyncEngine, type SyncStatus } from "@/lib/offline/engine";
import { supabase } from "@/lib/supabase";
import { supabaseRemote } from "@/lib/offline/supabaseRemote";
import { useUser } from "./AuthProvider";

type Sync = Pick<SyncEngine, "syncNow" | "retry" | "discard" | "dismissNotice">;
type Ctx = { db: LocalDb; engine: SyncEngine };

const OfflineContext = createContext<Ctx | null>(null);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const userId = user.id;
  // One db + engine per user id; a user change builds new ones and the effect below stops the old engine.
  const ctx = useMemo<Ctx>(() => {
    const db = openUserDb(userId);
    const sessionUserId = async () => (await supabase.auth.getSession()).data.session?.user.id ?? null;
    return { db, engine: new SyncEngine(db, supabaseRemote, userId, () => navigator.onLine, sessionUserId) };
  }, [userId]);

  useEffect(() => {
    ctx.engine.start();
    return () => {
      // Wait for any in-flight sync to finish before closing the db it is using.
      void (async () => {
        await ctx.engine.stop();
        ctx.db.close({ disableAutoOpen: false });
      })();
    };
  }, [ctx]);

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

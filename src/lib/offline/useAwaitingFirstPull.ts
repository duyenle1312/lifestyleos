"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useLocalDb, useSyncStatus } from "@/components/OfflineProvider";
import { type PulledScope, hasPulled, isAwaitingFirstPull } from "./pull";

/**
 * True on a first launch while the first sync is still running and nothing has been pulled for `scope`,
 * so an empty local table means "not loaded yet" rather than "no data". Uses the pulled marker, which is set even
 * when the server table is empty, so later syncs of an empty table don't show a spinner.
 */
export function useAwaitingFirstPull(scope: PulledScope): boolean {
  const db = useLocalDb();
  const { syncing } = useSyncStatus();
  const pulled = useLiveQuery(() => hasPulled(db, scope), [db, scope]);
  return isAwaitingFirstPull(syncing, pulled);
}
